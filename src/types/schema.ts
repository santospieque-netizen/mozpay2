export type DateTimestamp = string | number | Date;

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string; // Optional Google picture
  role: 'user' | 'admin';
  createdAt: DateTimestamp;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  pdfUrl?: string; // Link to the actual PDF storage
  categoryId: string; // Refers to Category.id
  rating: number;
  pages?: number;
  createdAt: DateTimestamp;
}

export interface Favorite {
  id: string;
  userId: string; // Refers to User.id
  bookId: string; // Refers to Book.id
  addedAt: DateTimestamp;
}

export interface ReadingHistory {
  id: string;
  userId: string; // Refers to User.id
  bookId: string; // Refers to Book.id
  lastPageRead: number;
  progressPercentage: number;
  lastReadAt: DateTimestamp;
}

export interface Download {
  id: string;
  userId: string; // Refers to User.id
  bookId: string; // Refers to Book.id
  downloadedAt: DateTimestamp;
}
