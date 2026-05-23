/**
 * Fetch wrapper for ccgmon API endpoints
 */

export async function getProjects() {
  const res = await fetch('/api/projects');
  if (!res.ok) {
    throw new Error(`Failed to fetch projects: ${res.statusText}`);
  }
  return res.json();
}

export async function getPlan(projectId, slug) {
  const res = await fetch(`/api/plans/${projectId}/${slug}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch plan ${projectId}/${slug}: ${res.statusText}`);
  }
  return res.json();
}

export async function getEvents() {
  const res = await fetch('/api/events');
  if (!res.ok) {
    throw new Error(`Failed to fetch events: ${res.statusText}`);
  }
  return res.json();
}
