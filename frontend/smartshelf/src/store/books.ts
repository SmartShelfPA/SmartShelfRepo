export type Book = {
  id: string;
  title: string;
  subject: string;
  examTags: ('IGCSE' | 'WAEC')[] | string[];
  coverUri?: string;
  pdfUri?: string;
  author?: string;
  lastAccessedAt?: string;
};

let books: Book[] = [];

export const getBooks = () => books;

export const addBook = (book: Book) => {
  books = [book, ...books];
};

export const getBookById = (id: string) => books.find((book) => book.id === id);

export const setBooks = (nextBooks: Book[]) => {
  books = nextBooks;
};
