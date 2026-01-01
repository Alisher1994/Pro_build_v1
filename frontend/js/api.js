// ========================================
// API Service - Взаимодействие с backend
// ========================================

const API_BASE_URL = window.PROBIM_API_BASE_URL || (() => {
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const isBackendOrigin = window.location.port === '3001' || window.location.origin.endsWith(':3001');

    if (!isBackendOrigin && (isLocalHost || window.location.port === '8000')) {
        return `${window.location.protocol}//${window.location.hostname}:3001/api`;
    }
    return '/api';
})();

class ApiService {
    constructor() {
        this.token = localStorage.getItem('probim_token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('probim_token', token);
        } else {
            localStorage.removeItem('probim_token');
        }
    }

    async request(url, options = {}) {
        const headers = { ...options.headers };
        if (!(options.body instanceof FormData) && !headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/json';
        }
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/verify')) {
            const hadToken = !!this.token;
            this.setToken(null);
            if (hadToken) window.location.reload();
            throw new Error('Unauthorized');
        }
        return response;
    }

    async login(email, password) {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Login failed');
        this.setToken(json.token);
        return json;
    }

    async verifyToken() {
        if (!this.token) return null;
        const response = await this.request(`${API_BASE_URL}/auth/verify`);
        if (!response.ok) {
            this.setToken(null);
            return null;
        }
        return await response.json();
    }

    // Projects
    async getProjects() {
        const response = await this.request(`${API_BASE_URL}/projects`);
        if (!response.ok) throw new Error('Failed to fetch projects');
        const json = await response.json();
        return json?.data || json || [];
    }

    async getProjectHierarchy(projectId) {
        const response = await this.request(`${API_BASE_URL}/projects/${projectId}/hierarchy`);
        if (!response.ok) throw new Error('Failed to fetch project hierarchy');
        return await response.json();
    }

    async getProject(id) {
        const response = await this.request(`${API_BASE_URL}/projects/${id}`);
        if (!response.ok) throw new Error('Failed to fetch project');
        return await response.json();
    }

    async createProject(data) {
        const response = await this.request(`${API_BASE_URL}/projects`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create project');
        return await response.json();
    }

    async updateProject(id, data) {
        const response = await this.request(`${API_BASE_URL}/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update project');
        return await response.json();
    }

    async deleteProject(id) {
        const response = await this.request(`${API_BASE_URL}/projects/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete project');
        return await response.json();
    }

    // Blocks
    async getBlocks(projectId) {
        const response = await this.request(`${API_BASE_URL}/blocks?projectId=${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch blocks');
        return await response.json();
    }

    async getBlock(id) {
        const response = await this.request(`${API_BASE_URL}/blocks/${id}`);
        if (!response.ok) throw new Error('Failed to fetch block');
        return await response.json();
    }

    async createBlock(data) {
        const response = await this.request(`${API_BASE_URL}/blocks`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create block');
        return await response.json();
    }

    async updateBlock(id, data) {
        const response = await this.request(`${API_BASE_URL}/blocks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update block');
        return await response.json();
    }

    async deleteBlock(id) {
        const response = await this.request(`${API_BASE_URL}/blocks/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete block');
        return await response.json();
    }

    // Estimates
    async getEstimates(projectId, blockId) {
        let url = `${API_BASE_URL}/estimates?projectId=${projectId}`;
        if (blockId) url += `&blockId=${blockId}`;
        const response = await this.request(url);
        if (!response.ok) throw new Error('Failed to fetch estimates');
        return await response.json();
    }

    async getEstimate(id) {
        const response = await this.request(`${API_BASE_URL}/estimates/${id}`);
        if (!response.ok) throw new Error('Failed to fetch estimate');
        return await response.json();
    }

    async getFullEstimate(id) {
        const response = await this.request(`${API_BASE_URL}/estimates/${id}/full`);
        if (!response.ok) throw new Error('Failed to fetch full estimate');
        return await response.json();
    }

    async createEstimate(data) {
        const response = await this.request(`${API_BASE_URL}/estimates`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create estimate');
        return await response.json();
    }

    async updateEstimate(id, data) {
        const response = await this.request(`${API_BASE_URL}/estimates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update estimate');
        return await response.json();
    }

    async deleteEstimate(id) {
        const response = await this.request(`${API_BASE_URL}/estimates/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete estimate');
        return await response.json();
    }

    // Sections
    async getSections(estimateId) {
        const response = await this.request(`${API_BASE_URL}/sections?estimateId=${estimateId}`);
        if (!response.ok) throw new Error('Failed to fetch sections');
        return await response.json();
    }

    async createSection(data) {
        const response = await this.request(`${API_BASE_URL}/sections`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create section');
        return await response.json();
    }

    async updateSection(id, data) {
        const response = await this.request(`${API_BASE_URL}/sections/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update section');
        return await response.json();
    }

    async deleteSection(id) {
        const response = await this.request(`${API_BASE_URL}/sections/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete section');
        return await response.json();
    }

    async bulkImport(sectionId, data) {
        const response = await this.request(`${API_BASE_URL}/sections/${sectionId}/bulk-import`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Bulk import failed');
        return await response.json();
    }

    // Stages
    async getStages(sectionId) {
        const response = await this.request(`${API_BASE_URL}/stages?sectionId=${sectionId}`);
        if (!response.ok) throw new Error('Failed to fetch stages');
        return await response.json();
    }

    async createStage(data) {
        const response = await this.request(`${API_BASE_URL}/stages`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create stage');
        return await response.json();
    }

    async updateStage(id, data) {
        const response = await this.request(`${API_BASE_URL}/stages/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update stage');
        return await response.json();
    }

    async deleteStage(id) {
        const response = await this.request(`${API_BASE_URL}/stages/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete stage');
        return await response.json();
    }

    // Work Types
    async getWorkTypes(stageId) {
        const response = await this.request(`${API_BASE_URL}/work-types?stageId=${stageId}`);
        if (!response.ok) throw new Error('Failed to fetch work types');
        return await response.json();
    }

    async createWorkType(data) {
        const response = await this.request(`${API_BASE_URL}/work-types`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create work type');
        return await response.json();
    }

    async updateWorkType(id, data) {
        const response = await this.request(`${API_BASE_URL}/work-types/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update work type');
        return await response.json();
    }

    async deleteWorkType(id) {
        const response = await this.request(`${API_BASE_URL}/work-types/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete work type');
        return await response.json();
    }

    // Resources
    async getResources(workTypeId) {
        const response = await this.request(`${API_BASE_URL}/resources?workTypeId=${workTypeId}`);
        if (!response.ok) throw new Error('Failed to fetch resources');
        return await response.json();
    }

    async createResource(data) {
        const response = await this.request(`${API_BASE_URL}/resources`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create resource');
        return await response.json();
    }

    async updateResource(id, data) {
        const response = await this.request(`${API_BASE_URL}/resources/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update resource');
        return await response.json();
    }

    async deleteResource(id) {
        const response = await this.request(`${API_BASE_URL}/resources/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete resource');
        return await response.json();
    }

    // Gantt
    async getGanttData(projectId) {
        const response = await this.request(`${API_BASE_URL}/gantt/${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch gantt data');
        return await response.json();
    }

    async updateGanttTask(id, task) {
        const normalizedId = (id && typeof id === 'object') ? (id.id ?? task?.id) : (id ?? task?.id);
        const response = await this.request(`${API_BASE_URL}/gantt/task/${encodeURIComponent(String(normalizedId))}`, {
            method: 'PUT',
            body: JSON.stringify(task),
        });
        if (!response.ok) throw new Error('Failed to update gantt task');
        return await response.json();
    }

    async deleteGanttTask(id) {
        if (!id) throw new Error('Missing task id');
        const response = await this.request(`${API_BASE_URL}/gantt/task/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete task');
        return await response.json();
    }

    async createGanttLink(link) {
        const response = await this.request(`${API_BASE_URL}/gantt/link`, {
            method: 'POST',
            body: JSON.stringify(link),
        });
        if (!response.ok) throw new Error('Failed to create link');
        return await response.json();
    }

    async deleteGanttLink(id) {
        const response = await this.request(`${API_BASE_URL}/gantt/link/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete link');
        return await response.json();
    }

    // Staff & Org
    async getEmployees() {
        const response = await this.request(`${API_BASE_URL}/employees`);
        if (!response.ok) throw new Error('Failed to fetch employees');
        const json = await response.json();
        return json?.data || json || [];
    }

    async getOrgStructure() {
        const response = await this.request(`${API_BASE_URL}/departments`);
        if (!response.ok) throw new Error('Failed to fetch departments');
        const json = await response.json();
        return json?.data || json || [];
    }

    async getPositions() {
        const response = await this.request(`${API_BASE_URL}/positions`);
        if (!response.ok) throw new Error('Failed to fetch positions');
        const json = await response.json();
        return json?.data || json || [];
    }

    async createEmployee(data) {
        const response = await this.request(`${API_BASE_URL}/employees`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create employee');
        return await response.json();
    }

    async updateEmployee(id, data) {
        const response = await this.request(`${API_BASE_URL}/employees/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update employee');
        return await response.json();
    }

    async deleteEmployee(id) {
        const response = await this.request(`${API_BASE_URL}/employees/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete employee');
        return await response.json();
    }

    // Subcontractors
    async getAllSubcontractors() {
        const response = await this.request(`${API_BASE_URL}/subcontractors`);
        if (!response.ok) throw new Error('Failed to fetch subcontractors');
        const json = await response.json();
        return json?.data || json || [];
    }

    async getSubcontractors(projectId) {
        const response = await this.request(`${API_BASE_URL}/subcontractors?projectId=${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch project subcontractors');
        const json = await response.json();
        return json?.data || json || [];
    }

    async getWorkTypeGroups() {
        const response = await this.request(`${API_BASE_URL}/work-type-groups`);
        if (!response.ok) throw new Error('Failed to fetch work type groups');
        return await response.json();
    }

    // Tenders
    async getTenders(projectId) {
        const response = await this.request(`${API_BASE_URL}/tenders?projectId=${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch tenders');
        return await response.json();
    }
}

window.api = new ApiService();
