import { Link } from 'react-router-dom';
import { Project, languageColors } from '../data/projects';

function ProjectCard({ project }: { project: Project }) {
  const langColor = languageColors[project.language] || '#888';

  return (
    <div className="project-card">
      <div className="project-card__header">
        <h3 className="project-card__name">{project.name}</h3>
        {project.stars > 0 && (
          <span className="project-card__stars">
            &#9733; {project.stars}
          </span>
        )}
      </div>

      <div className="project-card__topics">
        {project.topics.map((topic) => (
          <span key={topic} className="project-card__topic">{topic}</span>
        ))}
      </div>

      <p className="project-card__desc">{project.description}</p>

      <div className="project-card__footer">
        <span className="project-card__lang">
          <span className="project-card__lang-dot" style={{ background: langColor }} />
          {project.language}
        </span>
        <div className="project-card__links">
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="project-card__link"
          >
            GitHub
          </a>
          {project.demoUrl && (
            <Link to={project.demoUrl} className="project-card__link project-card__link--demo">
              Try Demo
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectCard;
