export type Quote = {
  text: string;
  author: string;
};

const fallbackQuotes: Quote[] = [
  {
    text: 'Education is the best investment a people can make.',
    author: 'Chief Obafemi Awolowo',
  },
  {
    text: 'Education is the key to development and progress.',
    author: 'Prof. J.F. Ade Ajayi',
  },
  {
    text: 'The foundation of every nation is the education of its youth.',
    author: 'Dr. Tai Solarin',
  },
];

const getRandomFallback = () =>
  fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];

import { API_BASE_URL } from './api';

export const fetchQuote = async (): Promise<Quote> => {
  try {
    const response = await fetch(`${API_BASE_URL}/quotes/random/`);
    if (!response.ok) {
      return getRandomFallback();
    }

    const data = (await response.json()) as { quote?: string; author?: string };
    if (!data?.quote || !data?.author) {
      return getRandomFallback();
    }

    return {
      text: data.quote,
      author: data.author,
    };
  } catch {
    return getRandomFallback();
  }
};
