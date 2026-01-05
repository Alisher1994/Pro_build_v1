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

    async loginSubcontractor(inn, password) {
        const response = await fetch(`${API_BASE_URL}/auth/login-subcontractor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inn, password }),
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

    async getEstimateFiles(id) {
        const response = await this.request(`${API_BASE_URL}/estimates/${id}/files`);
        if (!response.ok) throw new Error('Failed to fetch estimate files');
        return await response.json();
    }

    async uploadEstimateFile(id, file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await this.request(`${API_BASE_URL}/estimates/${id}/files`, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) throw new Error('Failed to upload estimate file');
        return await response.json();
    }

    async deleteEstimateFile(fileId) {
        const response = await this.request(`${API_BASE_URL}/estimates/files/${fileId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete estimate file');
        return await response.json();
    }

    async getSections(estimateId) {
        const response = await this.request(`${API_BASE_URL}/sections?estimateId=${estimateId}`);
        if (!response.ok) throw new Error('Failed to fetch sections');
        return await response.json();
    }

    async getSection(id) {
        const response = await this.request(`${API_BASE_URL}/sections/${id}`);
        if (!response.ok) throw new Error('Failed to fetch section');
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

    async getStage(id) {
        const response = await this.request(`${API_BASE_URL}/stages/${id}`);
        if (!response.ok) throw new Error('Failed to fetch stage');
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

    async getWorkType(id) {
        const response = await this.request(`${API_BASE_URL}/work-types/${id}`);
        if (!response.ok) throw new Error('Failed to fetch work type');
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

    async getResource(id) {
        // Пробуем сначала из таблицы Resource
        try {
            const res = await this.request(`${API_BASE_URL}/resources/${id}`);
            if (res.ok) return await res.json();
        } catch (e) { }

        // Если не нашли, пробуем из WorkType (т.к. в смете они часто используются как ресурсы)
        const res2 = await this.request(`${API_BASE_URL}/work-types/${id}`);
        if (!res2.ok) throw new Error('Resource not found in either Resources or WorkTypes');
        return await res2.json();
    }

    async linkIFC(id, elements) {
        // Пытаемся привязать к Resource
        try {
            const res = await this.request(`${API_BASE_URL}/resources/${id}/link-ifc`, {
                method: 'POST',
                body: JSON.stringify({ ifcElements: elements })
            });
            if (res.ok) return await res.json();
        } catch (e) { }

        // Если не вышло (напр. нет такого ID в Resource), пробуем обновить WorkType
        const res2 = await this.request(`${API_BASE_URL}/work-types/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ ifcElements: elements })
        });
        if (!res2.ok) throw new Error('Failed to link IFC elements to Resource or WorkType');
        return await res2.json();
    }

    // Gantt
    async getGanttData(projectId) {
        const response = await this.request(`${API_BASE_URL}/gantt/${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch gantt data');
        return await response.json();
    }

    async getGanttTaskHistory(taskId) {
        const response = await this.request(`${API_BASE_URL}/gantt/task/${taskId}/history`);
        if (!response.ok) throw new Error('Failed to fetch task history');
        return await response.json();
    }

    async getEstimateTreeForBlock(blockId) {
        const response = await this.request(`${API_BASE_URL}/gantt/estimate-tree/${blockId}`);
        if (!response.ok) throw new Error('Failed to fetch estimate tree for block');
        return await response.json();
    }

    async assignWorkTypeToFloor(projectId, floorTaskId, workTypeId, quantity, operation = 'set') {
        const response = await this.request(`${API_BASE_URL}/gantt/assign-worktype`, {
            method: 'POST',
            body: JSON.stringify({ projectId, floorTaskId, workTypeId, quantity, operation }),
        });
        if (!response.ok) throw new Error('Failed to assign work type');
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

    async updateTaskResourceAssignment(taskId, resourceId, data) {
        const response = await this.request(`${API_BASE_URL}/gantt/tasks/${taskId}/resources/${resourceId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update task resource assignment');
        return await response.json();
    }

    async getAssignmentSources(projectId) {
        const response = await this.request(`${API_BASE_URL}/gantt/assignment-sources/${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch assignment sources');
        return await response.json();
    }

    async getAssignmentEstimate(projectId, blockId, estimateId) {
        const response = await this.request(`${API_BASE_URL}/gantt/assignment-estimate/${projectId}/${blockId}/${estimateId}`);
        if (!response.ok) throw new Error('Failed to fetch assignment estimate');
        return await response.json();
    }

    async clearGanttSchedule(projectId) {
        const response = await this.request(`${API_BASE_URL}/gantt/${projectId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to clear gantt schedule');
        return await response.json();
    }

    // Staff & Org
    async getEmployees(projectId) {
        let url = `${API_BASE_URL}/employees`;
        if (projectId) url += `?projectId=${projectId}`;
        const response = await this.request(url);
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

    async createDepartment(data) {
        const response = await this.request(`${API_BASE_URL}/departments`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to create department');
        }
        return await response.json();
    }

    async updateDepartment(id, data) {
        const response = await this.request(`${API_BASE_URL}/departments/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update department');
        return await response.json();
    }

    async deleteDepartment(id) {
        const response = await this.request(`${API_BASE_URL}/departments/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to delete department');
        }
        return await response.json();
    }

    async getPositions() {
        const response = await this.request(`${API_BASE_URL}/positions`);
        if (!response.ok) throw new Error('Failed to fetch positions');
        const json = await response.json();
        return json?.data || json || [];
    }

    async createPosition(data) {
        const response = await this.request(`${API_BASE_URL}/positions`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to create position');
        }
        return await response.json();
    }

    async updatePosition(id, data) {
        const response = await this.request(`${API_BASE_URL}/positions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update position');
        return await response.json();
    }

    async deletePosition(id) {
        const response = await this.request(`${API_BASE_URL}/positions/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to delete position');
        }
        return await response.json();
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
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Failed to update employee');
        return json;
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

    // Tenders
    async getTenders(projectId) {
        const response = await this.request(`${API_BASE_URL}/tenders?projectId=${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch tenders');
        return await response.json();
    }

    async createTender(data) {
        const response = await this.request(`${API_BASE_URL}/tenders`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create tender');
        return await response.json();
    }

    async deleteTender(id) {
        const response = await this.request(`${API_BASE_URL}/tenders/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete tender');
        return await response.json();
    }

    async createTenderInvite(tenderId, subcontractorId) {
        const response = await this.request(`${API_BASE_URL}/tenders/${tenderId}/invites`, {
            method: 'POST',
            body: JSON.stringify({ subcontractorId }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to invite subcontractor');
        }
        return await response.json();
    }

    async toggleBidBlock(bidId, blocked, blockReason) {
        const response = await this.request(`${API_BASE_URL}/tenders/bids/${bidId}/block`, {
            method: 'POST',
            body: JSON.stringify({ blocked, blockReason }),
        });
        if (!response.ok) throw new Error('Failed to update bid block status');
        return await response.json();
    }

    async selectWinner(bidId) {
        const response = await this.request(`${API_BASE_URL}/tenders/bids/${bidId}/select-winner`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to select winner');
        return await response.json();
    }

    async createContract(bidId) {
        const response = await this.request(`${API_BASE_URL}/tenders/bids/${bidId}/create-contract`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to create contract');
        return await response.json();
    }

    async cancelContract(bidId) {
        const response = await this.request(`${API_BASE_URL}/tenders/bids/${bidId}/cancel-contract`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to cancel contract');
        return await response.json();
    }

    async getMyInvites() {
        const response = await this.request(`${API_BASE_URL}/tenders/my-invites`);
        if (!response.ok) throw new Error('Failed to fetch invited tenders');
        return await response.json();
    }

    async verifyInviteCode(inviteId, code) {
        const response = await this.request(`${API_BASE_URL}/tenders/my-invites/${inviteId}/verify`, {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Verification failed');
        }
        return await response.json();
    }

    // Work Type Groups
    async getWorkTypeGroups() {
        const response = await this.request(`${API_BASE_URL}/work-type-groups`);
        if (!response.ok) throw new Error('Failed to fetch work type groups');
        return await response.json();
    }

    async getWorkTypeGroup(id) {
        const response = await this.request(`${API_BASE_URL}/work-type-groups/${id}`);
        if (!response.ok) throw new Error('Failed to fetch work type group');
        return await response.json();
    }

    async createWorkTypeGroup(data) {
        const response = await this.request(`${API_BASE_URL}/work-type-groups`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create work type group');
        return await response.json();
    }

    async updateWorkTypeGroup(id, data) {
        const response = await this.request(`${API_BASE_URL}/work-type-groups/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update work type group');
        return await response.json();
    }

    async deleteWorkTypeGroup(id) {
        const response = await this.request(`${API_BASE_URL}/work-type-groups/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete work type group');
        return await response.json();
    }

    async getWorkTypeGroupItems(groupId) {
        const response = await this.request(`${API_BASE_URL}/work-type-groups/${groupId}/items`);
        if (!response.ok) throw new Error('Failed to fetch work type group items');
        return await response.json();
    }

    async createWorkTypeGroupItem(groupId, data) {
        const response = await this.request(`${API_BASE_URL}/work-type-groups/${groupId}/items`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create work type group item');
        return await response.json();
    }

    async updateWorkTypeGroupItem(groupId, itemId, data) {
        const response = await this.request(`${API_BASE_URL}/work-type-groups/${groupId}/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update work type group item');
        return await response.json();
    }

    async deleteWorkTypeGroupItem(groupId, itemId) {
        const response = await this.request(`${API_BASE_URL}/work-type-groups/${groupId}/items/${itemId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete work type group item');
        return await response.json();
    }

    // Finances
    async getFinanceSummary(projectId) {
        const response = await this.request(`${API_BASE_URL}/finances/project/${projectId}/summary`);
        if (!response.ok) throw new Error('Failed to fetch finance summary');
        return await response.json();
    }

    // Monitoring
    async getMonitoringData(projectId) {
        const response = await this.request(`${API_BASE_URL}/monitoring/${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch monitoring data');
        return await response.json();
    }
}

window.api = new ApiService();
