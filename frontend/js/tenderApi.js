// ===========================================
// Tender API Module
// ===========================================

const API_URL = 'http://localhost:3001/api';

/**
 * Получить список тендеров проекта
 */
async function getTenders(projectId) {
  const response = await fetch(`${API_URL}/tenders?projectId=${projectId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch tenders');
  }
  return await response.json();
}

/**
 * Получить детали тендера
 */
async function getTender(tenderId) {
  const response = await fetch(`${API_URL}/tenders/${tenderId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch tender');
  }
  return await response.json();
}

/**
 * Создать новый тендер
 */
async function createTender(tenderData) {
  const response = await fetch(`${API_URL}/tenders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(tenderData)
  });
  if (!response.ok) {
    throw new Error('Failed to create tender');
  }
  return await response.json();
}

/**
 * Пригласить субподрядчика в тендер
 */
async function inviteSubcontractor(tenderId, subcontractorId) {
  const response = await fetch(`${API_URL}/tenders/${tenderId}/invites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ subcontractorId })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to invite subcontractor');
  }
  return await response.json();
}

/**
 * Заблокировать/разблокировать отклик
 */
async function toggleBidBlock(bidId, blocked, blockReason) {
  const response = await fetch(`${API_URL}/tenders/bids/${bidId}/block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ blocked, blockReason })
  });
  if (!response.ok) {
    throw new Error('Failed to update bid block status');
  }
  return await response.json();
}

/**
 * Выбрать победителя
 */
async function selectWinner(bidId) {
  const response = await fetch(`${API_URL}/tenders/bids/${bidId}/select-winner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Failed to select winner');
  }
  return await response.json();
}

/**
 * Создать договор
 */
async function createContract(bidId) {
  const response = await fetch(`${API_URL}/tenders/bids/${bidId}/create-contract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Failed to create contract');
  }
  return await response.json();
}

/**
 * Отменить договор
 */
async function cancelContract(bidId) {
  const response = await fetch(`${API_URL}/tenders/bids/${bidId}/cancel-contract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Failed to cancel contract');
  }
  return await response.json();
}
