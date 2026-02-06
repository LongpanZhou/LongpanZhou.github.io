import PageShell from '../components/PageShell';
import { projects } from '../data/projects';
import ProjectCard from './ProjectCard';
import './projects.css';

function Projects() {
  return (
    <PageShell>
      <div className="projects-page">
        <h1 className="projects-page__title">Projects</h1>
        <p className="projects-page__subtitle">
          A collection of things I've built — from AI research to kernel drivers to web dev.
        </p>

        <div className="projects-grid">
          {projects.map((project) => (
            <ProjectCard key={project.name} project={project} />
          ))}
        </div>

        {/* GitHub Stats */}
        <div className="github-stats">
          <h2 className="github-stats__title">GitHub Stats</h2>
          <div className="github-stats__stat-grid">
            <div className="github-stats__stat">
              <span className="github-stats__stat-value">{projects.length}</span>
              <span className="github-stats__stat-label">Repositories</span>
            </div>
            <div className="github-stats__stat">
              <span className="github-stats__stat-value">{projects.reduce((sum, p) => sum + p.stars, 0)}</span>
              <span className="github-stats__stat-label">Total Stars</span>
            </div>
            <div className="github-stats__stat">
              <span className="github-stats__stat-value">{new Set(projects.map(p => p.language)).size}</span>
              <span className="github-stats__stat-label">Languages</span>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default Projects;
