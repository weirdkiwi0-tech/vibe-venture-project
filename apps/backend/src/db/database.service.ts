import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';

@Injectable()
export class DatabaseService implements OnApplicationBootstrap {
  private db!: Database.Database;

  onApplicationBootstrap() {
    const dbPath = process.env.DB_PATH ?? path.join(__dirname, '../../data/keepit.sqlite');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeDatabase();
  }

  private initializeDatabase() {
    // Questions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        authorId TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        subject TEXT NOT NULL,
        grade TEXT NOT NULL,
        attachments TEXT,
        visibility TEXT NOT NULL DEFAULT 'anonymous',
        status TEXT NOT NULL DEFAULT 'open',
        likeCount INTEGER NOT NULL DEFAULT 0,
        viewCount INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Answers table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS answers (
        id TEXT PRIMARY KEY,
        questionId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        attachments TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (questionId) REFERENCES questions(id)
      )
    `);

    // Question likes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS question_likes (
        id TEXT PRIMARY KEY,
        questionId TEXT NOT NULL,
        userId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        UNIQUE(questionId, userId),
        FOREIGN KEY (questionId) REFERENCES questions(id)
      )
    `);

    // Answer likes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS answer_likes (
        id TEXT PRIMARY KEY,
        answerId TEXT NOT NULL,
        userId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        UNIQUE(answerId, userId),
        FOREIGN KEY (answerId) REFERENCES answers(id)
      )
    `);

    // Comments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        answerId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (answerId) REFERENCES answers(id)
      )
    `);

    // Videos table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        uploaderId TEXT NOT NULL,
        title TEXT NOT NULL,
        subject TEXT,
        url TEXT NOT NULL,
        durationSeconds INTEGER NOT NULL,
        likeCount INTEGER NOT NULL DEFAULT 0,
        viewCount INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      )
    `);

    // Video comments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS video_comments (
        id TEXT PRIMARY KEY,
        videoId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (videoId) REFERENCES videos(id)
      )
    `);

    // Community posts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS community_posts (
        id TEXT PRIMARY KEY,
        authorId TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        attachments TEXT,
        viewCount INTEGER NOT NULL DEFAULT 0,
        likeCount INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      )
    `);

    // Community post likes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS community_post_likes (
        id TEXT PRIMARY KEY,
        postId TEXT NOT NULL,
        userId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        UNIQUE(postId, userId),
        FOREIGN KEY (postId) REFERENCES community_posts(id)
      )
    `);

    // Friend requests table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id TEXT PRIMARY KEY,
        fromUserId TEXT NOT NULL,
        toUserId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        createdAt TEXT NOT NULL
      )
    `);

    // Direct messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id TEXT PRIMARY KEY,
        senderId TEXT NOT NULL,
        recipientId TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )
    `);

    // Mentoring sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mentoring_sessions (
        id TEXT PRIMARY KEY,
        studentId TEXT NOT NULL,
        mentorId TEXT NOT NULL,
        channelId TEXT NOT NULL,
        question TEXT NOT NULL DEFAULT '',
        startedAt TEXT NOT NULL,
        slaDeadline TEXT NOT NULL,
        firstResponseAt TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        createdAt TEXT NOT NULL
      )
    `);

    // Mentoring messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mentoring_messages (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES mentoring_sessions(id)
      )
    `);

    // Reports table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        reporterId TEXT NOT NULL,
        targetType TEXT NOT NULL,
        targetId TEXT NOT NULL,
        reason TEXT NOT NULL,
        details TEXT,
        severity TEXT NOT NULL DEFAULT 'normal',
        status TEXT NOT NULL DEFAULT 'pending',
        createdAt TEXT NOT NULL
      )
    `);

    // Admin moderation audit log table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id TEXT PRIMARY KEY,
        adminId TEXT NOT NULL,
        action TEXT NOT NULL,
        targetType TEXT NOT NULL,
        targetId TEXT NOT NULL,
        reason TEXT NOT NULL,
        metadata TEXT,
        createdAt TEXT NOT NULL
      )
    `);
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}
