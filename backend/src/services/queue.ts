// src/services/queue.ts
import Bull from 'bull';
import config from '../config';
import logger from '../utils/logger';
import { aiService } from './ai';
import { databaseService } from './database';
import { cacheService } from './cache';

export interface AIJobData {
  userId: string;
  text: string;
  options: {
    mode: "1" | "2" | "3" | "4" | "5";
    stil: "knapp" | "neutral" | "ausführlicher";
    ansprache: "sie" | "neutral";
    layout?: string;
    includeRecommendations?: boolean;
  };
  priority: 'high' | 'normal' | 'low';
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AIJobResult {
  success: boolean;
  result?: any;
  error?: string;
  processingTime: number;
  tokensUsed?: number;
  costUsd?: number;
  cached?: boolean;
}

export class QueueService {
  private aiQueue: Bull.Queue<AIJobData>;
  private isInitialized: boolean = false;

  constructor() {
    this.aiQueue = new Bull('ai-processing', {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db + 1, // Use different DB for queues
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        delay: 0,
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.aiQueue.on('ready', () => {
      this.isInitialized = true;
      logger.info('AI Queue initialized successfully');
    });

    this.aiQueue.on('error', (error) => {
      logger.error('AI Queue error:', error);
    });

    this.aiQueue.on('waiting', (jobId) => {
      logger.debug(`Job ${jobId} is waiting`);
    });

    this.aiQueue.on('active', (job) => {
      logger.info(`Job ${job.id} started processing`, {
        userId: job.data.userId,
        priority: job.data.priority,
      });
    });

    this.aiQueue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed successfully`, {
        userId: job.data.userId,
        processingTime: result.processingTime,
        tokensUsed: result.tokensUsed,
        cached: result.cached,
      });
    });

    this.aiQueue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} failed`, {
        userId: job.data.userId,
        error: error.message,
        attempts: job.attemptsMade,
      });
    });

    this.aiQueue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} stalled`);
    });
  }

  async initialize(): Promise<void> {
    try {
      // Set up job processors
      await this.setupProcessors();
      this.isInitialized = true;
      logger.info('Queue service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize queue service:', error);
      throw error;
    }
  }

  private async setupProcessors(): Promise<void> {
    // Process AI jobs with concurrency control
    this.aiQueue.process('process-text', 5, async (job) => {
      return await this.processAIJob(job);
    });

    // Process high-priority jobs with higher concurrency
    this.aiQueue.process('process-text-high', 10, async (job) => {
      return await this.processAIJob(job);
    });
  }

  private async processAIJob(job: Bull.Job<AIJobData>): Promise<AIJobResult> {
    const startTime = Date.now();
    const { userId, text, options, requestId, ipAddress, userAgent } = job.data;

    try {
      // Update job status in database
      await databaseService.query(
        'UPDATE ai_jobs SET status = $1, started_at = NOW() WHERE id = $2',
        ['processing', requestId]
      );

      // Process with AI service
      const aiResponse = await aiService.processText(text, options, userId);
      
      const processingTime = Date.now() - startTime;
      
      // Calculate cost (simplified)
      const costUsd = aiResponse.usage ? 
        (aiResponse.usage.total_tokens * 0.0000015) : 0;

      // Update job status in database
      await databaseService.query(
        `UPDATE ai_jobs SET 
         status = $1, 
         completed_at = NOW(), 
         processing_time_ms = $2,
         tokens_used = $3,
         cost_usd = $4,
         output_data = $5
         WHERE id = $6`,
        [
          'completed',
          processingTime,
          aiResponse.usage?.total_tokens || 0,
          costUsd,
          JSON.stringify(aiResponse),
          requestId
        ]
      );

      // Track API usage
      await databaseService.trackApiUsage({
        userId,
        endpoint: '/structured',
        method: 'POST',
        statusCode: 200,
        responseTimeMs: processingTime,
        tokensUsed: aiResponse.usage?.total_tokens,
        costUsd: costUsd,
        textLength: text.length,
        cacheHit: aiResponse.cached,
        ipAddress,
        userAgent,
      });

      // Increment user API usage
      await databaseService.incrementApiUsage(userId);

      return {
        success: true,
        result: aiResponse,
        processingTime,
        tokensUsed: aiResponse.usage?.total_tokens,
        costUsd,
        cached: aiResponse.cached,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update job status in database
      await databaseService.query(
        `UPDATE ai_jobs SET 
         status = $1, 
         completed_at = NOW(), 
         processing_time_ms = $2,
         error_message = $3
         WHERE id = $4`,
        ['failed', processingTime, errorMessage, requestId]
      );

      // Track failed API usage
      await databaseService.trackApiUsage({
        userId,
        endpoint: '/structured',
        method: 'POST',
        statusCode: 500,
        responseTimeMs: processingTime,
        textLength: text.length,
        ipAddress,
        userAgent,
      });

      logger.error('AI job processing failed', {
        userId,
        requestId,
        error: errorMessage,
        processingTime,
      });

      return {
        success: false,
        error: errorMessage,
        processingTime,
      };
    }
  }

  async addAIJob(jobData: AIJobData): Promise<Bull.Job<AIJobData>> {
    if (!this.isInitialized) {
      throw new Error('Queue service not initialized');
    }

    // Create job record in database
    const jobRecord = await databaseService.query(
      `INSERT INTO ai_jobs (id, user_id, job_type, priority, input_data, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [
        jobData.requestId,
        jobData.userId,
        'process-text',
        this.getPriorityValue(jobData.priority),
        JSON.stringify(jobData)
      ]
    );

    // Add job to queue
    const queueName = jobData.priority === 'high' ? 'process-text-high' : 'process-text';
    const job = await this.aiQueue.add(queueName, jobData, {
      priority: this.getPriorityValue(jobData.priority),
      jobId: jobData.requestId,
      removeOnComplete: 10,
      removeOnFail: 5,
    });

    logger.info('AI job added to queue', {
      jobId: job.id,
      userId: jobData.userId,
      priority: jobData.priority,
    });

    return job;
  }

  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.aiQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress();
    const returnValue = job.returnvalue;

    return {
      id: job.id,
      state,
      progress,
      data: job.data,
      result: returnValue,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.aiQueue.getJob(jobId);
    if (!job) {
      return false;
    }

    await job.remove();
    
    // Update database
    await databaseService.query(
      'UPDATE ai_jobs SET status = $1, completed_at = NOW() WHERE id = $2',
      ['cancelled', jobId]
    );

    logger.info('Job cancelled', { jobId });
    return true;
  }

  async getQueueStats(): Promise<any> {
    const waiting = await this.aiQueue.getWaiting();
    const active = await this.aiQueue.getActive();
    const completed = await this.aiQueue.getCompleted();
    const failed = await this.aiQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      isInitialized: this.isInitialized,
    };
  }

  async pauseQueue(): Promise<void> {
    await this.aiQueue.pause();
    logger.info('AI queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.aiQueue.resume();
    logger.info('AI queue resumed');
  }

  async cleanQueue(): Promise<void> {
    await this.aiQueue.clean(24 * 60 * 60 * 1000, 'completed'); // Clean completed jobs older than 24h
    await this.aiQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // Clean failed jobs older than 7 days
    logger.info('Queue cleaned');
  }

  private getPriorityValue(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high': return 1;
      case 'normal': return 5;
      case 'low': return 10;
      default: return 5;
    }
  }

  async shutdown(): Promise<void> {
    await this.aiQueue.close();
    logger.info('Queue service shutdown complete');
  }
}

// Singleton instance
export const queueService = new QueueService();
