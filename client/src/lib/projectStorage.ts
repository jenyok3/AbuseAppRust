import { localStore, type LocalProject } from "@/lib/localStore";

export interface ProjectData {
  name: string;
  ref_link: string;
  app_name: string;
  app_type: string;
  mixed: string;
}

function toProjectData(project: LocalProject): ProjectData {
  return {
    name: project.name,
    ref_link: project.refLink || project.link || "",
    app_name: project.appName || project.name,
    app_type: project.appType || "",
    mixed: project.mixed || "",
  };
}

function toLocalProject(project: ProjectData, existing?: LocalProject): LocalProject {
  return {
    id: existing?.id ?? 0,
    name: project.name,
    type: "telegram",
    link: project.ref_link || "",
    createdAt: existing?.createdAt ?? Date.now(),
    appName: project.app_name || project.name,
    appType: project.app_type || "",
    refLink: project.ref_link || "",
    mixed: project.mixed || "",
  };
}

export const projectStorage = {
  getProjects(): [string, ProjectData][] {
    const projects = localStore.getProjects();
    return projects.map((project) => [project.name, toProjectData(project)]);
  },

  saveProjects(projects: [string, ProjectData][]): void {
    const existing = localStore.getProjects();
    const byName = new Map(existing.map((project) => [project.name, project] as const));
    const next = projects.map(([, data]) => toLocalProject(data, byName.get(data.name)));
    localStore.saveProjects(next);
  },

  addProject(project: ProjectData): boolean {
    const projects = localStore.getProjects();
    if (projects.some((p) => p.name === project.name)) return false;
    localStore.addProject(toLocalProject(project));
    return true;
  },

  updateProject(oldName: string, project: ProjectData): boolean {
    const projects = localStore.getProjects();
    const existing = projects.find((p) => p.name === oldName);
    if (!existing) return false;

    if (oldName !== project.name && projects.some((p) => p.name === project.name)) {
      return false;
    }

    localStore.updateProject(existing.id, toLocalProject(project, existing));
    return true;
  },

  deleteProject(name: string): boolean {
    const projects = localStore.getProjects();
    const existing = projects.find((p) => p.name === name);
    if (!existing) return false;
    return localStore.deleteProject(existing.id);
  },

  getProject(name: string): ProjectData | null {
    const projects = localStore.getProjects();
    const project = projects.find((p) => p.name === name);
    return project ? toProjectData(project) : null;
  },

  clearProjects(): void {
    localStore.saveProjects([]);
  },
};
