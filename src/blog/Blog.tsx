import PageShell from '../components/PageShell';
import './blog.css';

function Blog() {
  return (
    <PageShell>
      <div className="blog-page">
        <h1 className="blog-page__title">Blog</h1>
        <div className="blog-page__empty">
          <span className="blog-page__empty-icon">&#x2692;</span>
          <p className="blog-page__empty-heading">Under Construction</p>
          <p className="blog-page__empty-sub">Blog posts are on the way. Check back soon.</p>
        </div>
      </div>
    </PageShell>
  );
}

export default Blog;
