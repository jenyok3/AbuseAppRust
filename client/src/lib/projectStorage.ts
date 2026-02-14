interface ProjectData {
  name: string;
  ref_link: string;
  app_name: string;
  app_type: string;
  mixed: string;
}

const PROJECTS_STORAGE_KEY = 'telegram_projects';

export const projectStorage = {
  // Get all projects from localStorage
  getProjects(): [string, ProjectData][] {
    try {
      const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (!stored) return [];
      
      const projects = JSON.parse(stored);
      if (!Array.isArray(projects)) return [];
      
      // Ensure backward compatibility - add missing fields with defaults
      return projects.map(([name, data]: [string, any]) => {
        const fullData: ProjectData = {
          name: data.name || name,
          ref_link: data.ref_link || "",
          app_name: data.app_name || data.name || name,
          app_type: data.app_type || "",
          mixed: data.mixed || ""
        };
        return [name, fullData];
      });
    } catch (error) {
      console.error('Error loading projects from localStorage:', error);
      return [];
    }
  },

  // Save projects to localStorage
  saveProjects(projects: [string, ProjectData][]): void {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch (error) {
      console.error('Error saving projects to localStorage:', error);
    }
  },

  // Add a new project
  addProject(project: ProjectData): boolean {
    try {
      const projects = this.getProjects();
      
      // Check for duplicate name
      if (projects.some(([name]) => name === project.name)) {
        return false; // Duplicate found
      }
      
      projects.push([project.name, project]);
      this.saveProjects(projects);
      return true;
    } catch (error) {
      console.error('Error adding project:', error);
      return false;
    }
  },

  // Update an existing project
  updateProject(oldName: string, project: ProjectData): boolean {
    try {
      const projects = this.getProjects();
      const index = projects.findIndex(([name]) => name === oldName);
      
      if (index === -1) return false; // Project not found
      
      // If name changed, check for duplicate
      if (oldName !== project.name && projects.some(([name], i) => name === project.name && i !== index)) {
        return false; // New name already exists
      }
      
      projects[index] = [project.name, project];
      this.saveProjects(projects);
      return true;
    } catch (error) {
      console.error('Error updating project:', error);
      return false;
    }
  },

  // Delete a project
  deleteProject(name: string): boolean {
    try {
      const projects = this.getProjects();
      const filteredProjects = projects.filter(([projectName]) => projectName !== name);
      
      if (filteredProjects.length === projects.length) {
        return false; // Project not found
      }
      
      this.saveProjects(filteredProjects);
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      return false;
    }
  },

  // Get a specific project by name
  getProject(name: string): ProjectData | null {
    try {
      const projects = this.getProjects();
      const project = projects.find(([projectName]) => projectName === name);
      return project ? project[1] : null;
    } catch (error) {
      console.error('Error getting project:', error);
      return null;
    }
  },

  // Clear all projects
  clearProjects(): void {
    try {
      localStorage.removeItem(PROJECTS_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing projects:', error);
    }
  }
};
