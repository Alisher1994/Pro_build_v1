// ===========================================
// Tender API Module
// ===========================================

/**
 * Получить список тендеров проекта
 */
async function getTenders(projectId) {
  const response = await api.request(`/api/tenders?projectId=${projectId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch tenders');
  }
  return await response.json();
}

/**
 * Получить детали тендера
 */
async function getTender(tenderId) {
  const response = await api.request(`/api/tenders/${tenderId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch tender');
  }
  return await response.json();
}

/**
 * Создать новый тендер
 */
async function createTender(tenderData) {
  const response = await api.request(`/api/tenders`, {
    method: 'POST',
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
  const response = await api.request(`/api/tenders/${tenderId}/invites`, {
    method: 'POST',
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
  const response = await api.request(`/api/tenders/bids/${bidId}/block`, {
    method: 'POST',
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
  const response = await api.request(`/api/tenders/bids/${bidId}/select-winner`, {
    method: 'POST'
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
  const response = await api.request(`/api/tenders/bids/${bidId}/create-contract`, {
    method: 'POST'
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
  const response = await api.request(`/api/tenders/bids/${bidId}/cancel-contract`, {
    method: 'POST'
  });
  if (!response.ok) {
    throw new Error('Failed to cancel contract');
  }
  return await response.json();
}
