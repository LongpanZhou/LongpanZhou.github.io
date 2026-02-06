export interface BlogPostMeta {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  repoName: string;
}

export const blogPosts: BlogPostMeta[] = [
  {
    slug: 'building-gpt2-from-scratch',
    title: 'Building GPT-2 From Scratch',
    date: '2024-12-15',
    excerpt: 'A deep dive into implementing GPT-2 from scratch using PyTorch — tokenization, attention, training, and inference.',
    tags: ['Deep Learning', 'Python', 'Transformers'],
    repoName: 'Pat-GPT',
  },
  {
    slug: 'windows-kernel-driver',
    title: 'Writing a Windows Kernel Driver',
    date: '2024-10-20',
    excerpt: 'Exploring kernel-mode development on Windows — driver entry, IOCTL communication, process manipulation, and signing.',
    tags: ['Kernel Dev', 'C', 'Windows'],
    repoName: 'KernelDriver',
  },
  {
    slug: '3d-web-threejs',
    title: '3D Web Experiences with Three.js',
    date: '2024-09-05',
    excerpt: 'How I built an immersive 3D Summoner\'s Rift portfolio using React Three Fiber, GLB models, and VRAM optimization.',
    tags: ['Three.js', 'React', 'WebGL'],
    repoName: 'LongpanZhou.github.io',
  },
];

export function getPostBySlug(slug: string): BlogPostMeta | undefined {
  return blogPosts.find(p => p.slug === slug);
}

export function getReadmeUrl(repoName: string): string {
  return `https://raw.githubusercontent.com/LongpanZhou/${repoName}/main/README.md`;
}
