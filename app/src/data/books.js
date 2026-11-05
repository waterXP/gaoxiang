import book0Info from './books/book-001/info.js'
import { chapters as book0Chapters } from './books/book-001/meta.js'
import { allChapterPages as book0Pages } from './books/book-001/index.js'
import book1Info from './books/book-002/info.js'
import { chapters as book1Chapters } from './books/book-002/meta.js'
import { allChapterPages as book1Pages } from './books/book-002/index.js'

export const books = [
  { ...book0Info, chapters: book0Chapters, allChapterPages: book0Pages },
  { ...book1Info, chapters: book1Chapters, allChapterPages: book1Pages }
]
