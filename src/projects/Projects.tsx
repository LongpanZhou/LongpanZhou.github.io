import PageShell from '../components/PageShell';
import DrawFrame from '../components/DrawFrame';
import ProjectCard from './ProjectCard';
import { useProjects } from './useProjects';
import './projects.css';

function Projects() {
  const { projects, loading } = useProjects();

  const totalStars = projects.reduce((sum, p) => sum + p.stars, 0);
  const languageCount = new Set(projects.map((p) => p.language)).size;

  return (
    <PageShell>
      <DrawFrame ready={!loading}>
        <div className="projects-page">
          <h1 className="projects-page__title" data-draw="projects.title" data-draw-kind="nexus">Projects</h1>
          <p className="projects-page__subtitle" data-draw-type>
            A collection of things I've built — from AI research to kernel drivers to web dev.
          </p>

          {loading ? (
            <p className="projects-page__subtitle" role="status">Loading projects from GitHub…</p>
          ) : (
            <div className="projects-grid">
              {projects.map((project) => (
                <ProjectCard key={project.name} project={project} />
              ))}
            </div>
          )}

          {/* GitHub Stats */}
          <div className="github-stats">
            <h2 className="github-stats__title">GitHub Stats</h2>
            <div className="github-stats__stat-grid">
              <div className="github-stats__stat" data-draw="stat.repositories" data-draw-kind="tower">
                <span className="github-stats__stat-value">{projects.length}</span>
                <span className="github-stats__stat-label">Repositories</span>
              </div>
              <div className="github-stats__stat" data-draw="stat.stars" data-draw-kind="tower">
                <span className="github-stats__stat-value">{totalStars}</span>
                <span className="github-stats__stat-label">Total Stars</span>
              </div>
              <div className="github-stats__stat" data-draw="stat.languages" data-draw-kind="tower">
                <span className="github-stats__stat-value">{languageCount}</span>
                <span className="github-stats__stat-label">Languages</span>
              </div>
            </div>
          </div>
        </div>
      </DrawFrame>
    </PageShell>
  );
}

export default Projects;
