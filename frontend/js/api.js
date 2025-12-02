// ========================================
// API Service - Взаимодействие с backend
// ========================================

const API_BASE_URL = '/api';

class ApiService {
    // ========================================
    // Projects
    // ========================================
    async getProjects() {
        const response = await fetch(`${API_BASE_URL}/projects`);
        if (!response.ok) throw new Error('Failed to fetch projects');
        return await response.json();
    }

    async getProject(id) {
        const response = await fetch(`${API_BASE_URL}/projects/${id}`);
        if (!response.ok) throw new Error('Failed to fetch project');
        return await response.json();
    }

    async createProject(data) {
        const response = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create project');
        return await response.json();
    }

    async updateProject(id, data) {
        const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update project');
        return await response.json();
    }

    async deleteProject(id) {
        const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete project');
        return await response.json();
    }

    // ========================================
    // Blocks
    // ========================================
    async getBlocks(projectId) {
        const response = await fetch(`${API_BASE_URL}/blocks?projectId=${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch blocks');
        return await response.json();
    }

    async getBlock(id) {
        const response = await fetch(`${API_BASE_URL}/blocks/${id}`);
        if (!response.ok) throw new Error('Failed to fetch block');
        return await response.json();
    }

    async createBlock(data) {
        const response = await fetch(`${API_BASE_URL}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create block');
        return await response.json();
    }

    async updateBlock(id, data) {
        const response = await fetch(`${API_BASE_URL}/blocks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update block');
        return await response.json();
    }

    async deleteBlock(id) {
        const response = await fetch(`${API_BASE_URL}/blocks/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete block');
        return await response.json();
    }

    // ========================================
    // Estimates
    // ========================================
    async getEstimates(projectId, blockId) {
        let url = `${API_BASE_URL}/estimates?projectId=${projectId}`;
        if (blockId) url += `&blockId=${blockId}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch estimates');
        return await response.json();
    }

    async getEstimate(id) {
        const response = await fetch(`${API_BASE_URL}/estimates/${id}`);
        if (!response.ok) throw new Error('Failed to fetch estimate');
        return await response.json();
    }

    async createEstimate(data) {
        const response = await fetch(`${API_BASE_URL}/estimates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create estimate');
        return await response.json();
    }

    async updateEstimate(id, data) {
        const response = await fetch(`${API_BASE_URL}/estimates/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update estimate');
        return await response.json();
    }

    async deleteEstimate(id) {
        const response = await fetch(`${API_BASE_URL}/estimates/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete estimate');
        return await response.json();
    }

    // ========================================
    // Sections
    // ========================================
    async getSections(estimateId) {
        const response = await fetch(`${API_BASE_URL}/sections?estimateId=${estimateId}`);
        if (!response.ok) throw new Error('Failed to fetch sections');
        return await response.json();
    }

    async getSection(id) {
        const response = await fetch(`${API_BASE_URL}/sections/${id}`);
        if (!response.ok) throw new Error('Failed to fetch section');
        return await response.json();
    }

    async createSection(data) {
        const response = await fetch(`${API_BASE_URL}/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create section');
        return await response.json();
    }

    async updateSection(id, data) {
        const response = await fetch(`${API_BASE_URL}/sections/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update section');
        return await response.json();
    }

    async deleteSection(id) {
        const response = await fetch(`${API_BASE_URL}/sections/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete section');
        return await response.json();
    }

    async uploadIFC(sectionId, file) {
        const formData = new FormData();
        formData.append('ifcFile', file);
        
        const response = await fetch(`${API_BASE_URL}/sections/${sectionId}/upload-ifc`, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) throw new Error('Failed to upload IFC');
        return await response.json();
    }

    // ========================================
    // Stages
    // ========================================
    async getStages(sectionId) {
        const response = await fetch(`${API_BASE_URL}/stages?sectionId=${sectionId}`);
        if (!response.ok) throw new Error('Failed to fetch stages');
        return await response.json();
    }

    async getStage(id) {
        const response = await fetch(`${API_BASE_URL}/stages/${id}`);
        if (!response.ok) throw new Error('Failed to fetch stage');
        return await response.json();
    }

    async createStage(data) {
        const response = await fetch(`${API_BASE_URL}/stages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create stage');
        return await response.json();
    }

    async updateStage(id, data) {
        const response = await fetch(`${API_BASE_URL}/stages/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update stage');
        return await response.json();
    }

    async deleteStage(id) {
        const response = await fetch(`${API_BASE_URL}/stages/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete stage');
        return await response.json();
    }

    // ========================================
    // Work Types
    // ========================================
    async getWorkTypes(stageId) {
        const response = await fetch(`${API_BASE_URL}/work-types?stageId=${stageId}`);
        if (!response.ok) throw new Error('Failed to fetch work types');
        return await response.json();
    }

    async getWorkType(id) {
        const response = await fetch(`${API_BASE_URL}/work-types/${id}`);
        if (!response.ok) throw new Error('Failed to fetch work type');
        return await response.json();
    }

    async createWorkType(data) {
        const response = await fetch(`${API_BASE_URL}/work-types`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create work type');
        return await response.json();
    }

    async updateWorkType(id, data) {
        const response = await fetch(`${API_BASE_URL}/work-types/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update work type');
        return await response.json();
    }

    async deleteWorkType(id) {
        const response = await fetch(`${API_BASE_URL}/work-types/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete work type');
        return await response.json();
    }

    // ========================================
    // Resources
    // ========================================
    async getResources(workTypeId) {
        const response = await fetch(`${API_BASE_URL}/resources?workTypeId=${workTypeId}`);
        if (!response.ok) throw new Error('Failed to fetch resources');
        return await response.json();
    }

    async getResource(id) {
        const response = await fetch(`${API_BASE_URL}/resources/${id}`);
        if (!response.ok) throw new Error('Failed to fetch resource');
        return await response.json();
    }

    async createResource(data) {
        const response = await fetch(`${API_BASE_URL}/resources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create resource');
        return await response.json();
    }

    async updateResource(id, data) {
        const response = await fetch(`${API_BASE_URL}/resources/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update resource');
        return await response.json();
    }

    async deleteResource(id) {
        const response = await fetch(`${API_BASE_URL}/resources/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete resource');
        return await response.json();
    }

    async linkIFC(resourceId, ifcElements, ifcProperties) {
        const response = await fetch(`${API_BASE_URL}/resources/${resourceId}/link-ifc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ifcElements, ifcProperties }),
        });
        if (!response.ok) throw new Error('Failed to link IFC');
        return await response.json();
    }

    // ========================================
    // Schedules
    // ========================================
    async getSchedules(projectId) {
        const response = await fetch(`${API_BASE_URL}/schedules?projectId=${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch schedules');
        return await response.json();
    }

    async getSchedule(id) {
        const response = await fetch(`${API_BASE_URL}/schedules/${id}`);
        if (!response.ok) throw new Error('Failed to fetch schedule');
        return await response.json();
    }

    async createSchedule(data) {
        const response = await fetch(`${API_BASE_URL}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create schedule');
        return await response.json();
    }

    async updateSchedule(id, data) {
        const response = await fetch(`${API_BASE_URL}/schedules/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update schedule');
        return await response.json();
    }

    async deleteSchedule(id) {
        const response = await fetch(`${API_BASE_URL}/schedules/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete schedule');
        return await response.json();
    }

    // Schedule Items
    async getScheduleItems(scheduleId) {
        const response = await fetch(`${API_BASE_URL}/schedules/${scheduleId}/items`);
        if (!response.ok) throw new Error('Failed to fetch schedule items');
        return await response.json();
    }

    async createScheduleItem(scheduleId, data) {
        const response = await fetch(`${API_BASE_URL}/schedules/${scheduleId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create schedule item');
        return await response.json();
    }

    async updateScheduleItem(scheduleId, itemId, data) {
        const response = await fetch(`${API_BASE_URL}/schedules/${scheduleId}/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update schedule item');
        return await response.json();
    }

    async deleteScheduleItem(scheduleId, itemId) {
        const response = await fetch(`${API_BASE_URL}/schedules/${scheduleId}/items/${itemId}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete schedule item');
        return await response.json();
    }

    // ========================================
    // Supplies
    // ========================================
    async getSupplies(projectId) {
        const response = await fetch(`${API_BASE_URL}/supplies?projectId=${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch supplies');
        return await response.json();
    }

    async createSupply(data) {
        const response = await fetch(`${API_BASE_URL}/supplies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create supply');
        return await response.json();
    }

    // ========================================
    // Finances
    // ========================================
    async getFinances(projectId) {
        const response = await fetch(`${API_BASE_URL}/finances?projectId=${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch finances');
        return await response.json();
    }

    async createFinance(data) {
        const response = await fetch(`${API_BASE_URL}/finances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create finance');
        return await response.json();
    }

    async getFinanceSummary(projectId) {
        const response = await fetch(`${API_BASE_URL}/finances/project/${projectId}/summary`);
        if (!response.ok) throw new Error('Failed to fetch finance summary');
        return await response.json();
    }

    // ========================================
    // Recalculate totals (cascade up the hierarchy)
    // ========================================
    async recalculateWorkType(workTypeId) {
        const response = await fetch(`${API_BASE_URL}/work-types/${workTypeId}/recalculate`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to recalculate work type');
        return await response.json();
    }

    async recalculateStage(stageId) {
        const response = await fetch(`${API_BASE_URL}/stages/${stageId}/recalculate`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to recalculate stage');
        return await response.json();
    }

    async recalculateSection(sectionId) {
        const response = await fetch(`${API_BASE_URL}/sections/${sectionId}/recalculate`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to recalculate section');
        return await response.json();
    }

    async recalculateEstimate(estimateId) {
        const response = await fetch(`${API_BASE_URL}/estimates/${estimateId}/recalculate`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to recalculate estimate');
        return await response.json();
    }

    // Cascade recalculation from resource up to estimate
    async recalculateCascade(workTypeId, stageId, sectionId, estimateId) {
        // Recalculate in order: WorkType -> Stage -> Section -> Estimate
        if (workTypeId) await this.recalculateWorkType(workTypeId);
        if (stageId) await this.recalculateStage(stageId);
        if (sectionId) await this.recalculateSection(sectionId);
        if (estimateId) await this.recalculateEstimate(estimateId);
    }
}

// Экспортируем единственный экземпляр
const api = new ApiService();
