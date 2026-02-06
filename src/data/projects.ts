export interface Project {
  name: string;
  description: string;
  language: string;
  stars: number;
  topics: string[];
  url: string;
  featured: boolean;
  demoUrl?: string;
}

export const projects: Project[] = [
  {
    name: 'ChatGPT-Bypass',
    description: 'A short prompt bypass to allow ChatGPT to answer all questions. Demonstrates understanding of LLM behavior and prompt engineering.',
    language: 'Python',
    stars: 27,
    topics: ['AI', 'Prompt Engineering'],
    url: 'https://github.com/LongpanZhou/ChatGPT-Bypass',
    featured: true,
  },
  {
    name: 'CS2-External',
    description: 'An external cheat for CS2, created for educational purposes to explore the game. Demonstrates low-level Windows programming and reverse engineering.',
    language: 'C++',
    stars: 24,
    topics: ['Reverse Engineering', 'Windows'],
    url: 'https://github.com/LongpanZhou/CS2-External',
    featured: true,
  },
  {
    name: 'Pat-GPT',
    description: 'Implements standard GPT-2 model, KV cache & ROPE llama model, and MLA & MOE deepseek model in PyTorch.',
    language: 'Python',
    stars: 0,
    topics: ['Deep Learning', 'Transformers'],
    url: 'https://github.com/LongpanZhou/Pat-GPT',
    featured: true,
  },
  {
    name: 'KernelDriver',
    description: 'Microsoft OS kernel functions reimplementation. Demonstrates kernel development, IOCTL communication, and driver signing.',
    language: 'C',
    stars: 1,
    topics: ['Kernel Dev', 'Windows'],
    url: 'https://github.com/LongpanZhou/KernelDriver',
    featured: true,
  },
  {
    name: 'LongpanZhou.github.io',
    description: 'This portfolio website — an immersive 3D Summoner\'s Rift experience built with React, Three.js, and React Three Fiber.',
    language: 'TypeScript',
    stars: 0,
    topics: ['3D Graphics', 'Web Dev'],
    url: 'https://github.com/LongpanZhou/LongpanZhou.github.io',
    featured: true,
  },
  {
    name: 'Posthog-Blocker',
    description: 'Block PostHog analytics tracking. Browser extension to prevent PostHog from collecting user data.',
    language: 'JavaScript',
    stars: 0,
    topics: ['Analytics', 'Privacy'],
    url: 'https://github.com/LongpanZhou/Posthog-Blocker',
    featured: true,
  },
  {
    name: 'DeepLearning',
    description: 'Practical PyTorch implementations covering foundational techniques to advanced models.',
    language: 'Python',
    stars: 0,
    topics: ['Deep Learning', 'PyTorch'],
    url: 'https://github.com/LongpanZhou/DeepLearning',
    featured: true,
  },
  {
    name: 'AnimalClicks',
    description: 'NPM package for adding animal emoji effects to mouse clicks on any website. Published on npm.',
    language: 'JavaScript',
    stars: 0,
    topics: ['NPM Package', 'Web Dev'],
    url: 'https://github.com/LongpanZhou/AnimalClicks',
    featured: true,
    demoUrl: '/animalclicks',
  },
  {
    name: 'RecycleSorting',
    description: 'Sort plastics based on their FTIR readings using machine learning.',
    language: 'Python',
    stars: 0,
    topics: ['Machine Learning'],
    url: 'https://github.com/LongpanZhou/RecycleSorting',
    featured: false,
  },
  {
    name: 'Python-PEP9-Assembler',
    description: 'Translator for converting Python code into PEP9 assembly code.',
    language: 'Python',
    stars: 0,
    topics: ['Compiler', 'Assembly'],
    url: 'https://github.com/LongpanZhou/Python-PEP9-Assembler',
    featured: false,
  },
  {
    name: 'London-Subway-Station',
    description: 'Path finding algorithm implemented based on real London subway station data.',
    language: 'Jupyter Notebook',
    stars: 0,
    topics: ['Algorithms'],
    url: 'https://github.com/LongpanZhou/London-Subway-Station',
    featured: false,
  },
  {
    name: 'TradCrew',
    description: 'Tools to calculate stock information and trading metrics.',
    language: 'Python',
    stars: 0,
    topics: ['Finance'],
    url: 'https://github.com/LongpanZhou/TradCrew',
    featured: false,
  },
  {
    name: 'TAC-Price-Scrapper',
    description: 'Web scraper for TAC price data.',
    language: 'JavaScript',
    stars: 0,
    topics: ['Web Scraping'],
    url: 'https://github.com/LongpanZhou/TAC-Price-Scrapper',
    featured: false,
  },
  {
    name: 'Israel-Palestine-War-Map',
    description: 'Interactive map visualization of the Israel-Palestine conflict.',
    language: 'JavaScript',
    stars: 0,
    topics: ['Visualization'],
    url: 'https://github.com/LongpanZhou/Israel-Palestine-War-Map',
    featured: false,
  },
];

export const languageColors: Record<string, string> = {
  Python: '#3572A5',
  TypeScript: '#3178C6',
  JavaScript: '#F1E05A',
  'C++': '#F34B7D',
  C: '#555555',
  HTML: '#E34C26',
  CSS: '#563D7C',
  'Jupyter Notebook': '#DA5B0B',
};

export function getAllLanguages(): string[] {
  return [...new Set(projects.map(p => p.language))];
}

export function getAllTopics(): string[] {
  return [...new Set(projects.flatMap(p => p.topics))];
}
