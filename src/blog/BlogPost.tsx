import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PageShell from '../components/PageShell';
import { blogPosts, getPostBySlug, getReadmeUrl } from '../data/blogPosts';
import './blog.css';

function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!post) return;

    const url = getReadmeUrl(post.repoName);
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.text();
      })
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setContent(null);
        setLoading(false);
      });
  }, [post]);

  if (!post) {
    return (
      <PageShell>
        <div className="blog-post">
          <Link to="/blog" className="blog-post__back">&larr; Back to Blog</Link>
          <p style={{ color: '#F0E6D2', marginTop: 24 }}>Post not found.</p>
        </div>
      </PageShell>
    );
  }

  // Find prev/next posts
  const currentIndex = blogPosts.findIndex(p => p.slug === slug);
  const prevPost = currentIndex > 0 ? blogPosts[currentIndex - 1] : null;
  const nextPost = currentIndex < blogPosts.length - 1 ? blogPosts[currentIndex + 1] : null;

  return (
    <PageShell>
      <div className="blog-post">
        <Link to="/blog" className="blog-post__back">&larr; Back to Blog</Link>

        <div className="blog-post__header">
          <h1 className="blog-post__title">{post.title}</h1>
          <div className="blog-post__meta">
            {post.date} &middot;{' '}
            <a
              href={`https://github.com/LongpanZhou/${post.repoName}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {loading ? (
          <div className="blog-post__loading">Loading content...</div>
        ) : content ? (
          <div className="blog-post__content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="blog-post__content">
            <p>{post.excerpt}</p>
            <p style={{ color: '#a09b8c', marginTop: 16 }}>
              Full content is available on{' '}
              <a
                href={`https://github.com/LongpanZhou/${post.repoName}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>.
            </p>
          </div>
        )}

        <div className="blog-post__nav">
          <div>
            {prevPost && (
              <Link to={`/blog/${prevPost.slug}`}>&larr; {prevPost.title}</Link>
            )}
          </div>
          <div>
            {nextPost && (
              <Link to={`/blog/${nextPost.slug}`}>{nextPost.title} &rarr;</Link>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default BlogPost;
