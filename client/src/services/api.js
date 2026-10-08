import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://final-7w4y.onrender.com/api',
});


// Interceptor to add auth token dynamically from localStorage
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

    if (status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => API.post('/auth/login', credentials),
  register: (userData) => API.post('/auth/register', userData),
  getProfile: () => API.get('/auth/profile'),
  forgotPassword: (email) => API.post('/auth/forgot-password', { email }),
  verifyEmail: () => API.post('/auth/verify-email'),
  uploadAvatar: (formData) =>
    API.post('/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  removeAvatar: () => API.delete('/auth/avatar'),
};


export const projectAPI = {
  create: (data) => API.post('/projects', data),
  getAll: () => API.get('/projects'),
  getById: (id) => API.get(`/projects/${id}`),
  update: (id, data) => API.put(`/projects/${id}`, data),
  delete: (id) => API.delete(`/projects/${id}`),
  addMember: (id, email) => API.post(`/projects/${id}/members`, { email }),
};

export const taskAPI = {
  create: (data) => API.post('/tasks', data),
  getByProject: (projectId) => API.get(`/tasks/project/${projectId}`),
  update: (id, data) => API.put(`/tasks/${id}`, data),
  delete: (id) => API.delete(`/tasks/${id}`),
  addComment: (id, text) => API.post(`/tasks/${id}/comments`, { text }),
};

export const assessmentAPI = {
  scan: (projectId, formData) =>
    API.post(`/assessments/scan/${projectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  scanSimulated: (projectId) => API.post(`/assessments/scan/${projectId}`),
  getByProject: (projectId) => API.get(`/assessments/project/${projectId}`),
};

export const aiAPI = {
  generateDoc: (projectId, data) => API.post(`/ai/generate-doc/${projectId}`, data),
  exportPdf: (data) => API.post('/ai/export-pdf', data, { responseType: 'blob' }),
  // projectId is optional: when provided the mentor receives stored project evidence
  mentorChat: (message, chatHistory, projectId) =>
    API.post('/ai/mentor-chat', {
      message,
      chatHistory,
      ...(projectId ? { projectId } : {}),
    }),
};

export const reproducibilityAPI = {
  check: (projectId, formData) =>
    API.post(`/reproducibility/check/${projectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  checkSimulated: (projectId) => API.post(`/reproducibility/check/${projectId}`),
  getByProject: (projectId) => API.get(`/reproducibility/project/${projectId}`),
};

export const githubAPI = {
  connect: (projectId, repositoryUrl) => API.post(`/github/connect/${projectId}`, { repositoryUrl }),
  getDetails: (projectId) => API.get(`/github/details/${projectId}`),
  getAnalytics: (projectId) => API.get(`/github/analytics/${projectId}`),
};

export const collaborationAPI = {
  getChat: (projectId) => API.get(`/collaboration/chat/${projectId}`),
  sendMessage: (projectId, text) => API.post(`/collaboration/chat/${projectId}`, { text }),
  getNotifications: () => API.get('/collaboration/notifications'),
  markRead: (id) => API.put(`/collaboration/notifications/${id}/read`),
  getActivity: (projectId) => API.get(`/collaboration/activity/${projectId}`),
};

export const notebookAPI = {
  upload: (projectId, formData) =>
    API.post(`/notebooks/upload/${projectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getByProject: (projectId, search = '', category = 'All') =>
    API.get(`/notebooks/project/${projectId}?search=${search}&category=${category}`),
  delete: (id) => API.delete(`/notebooks/${id}`),
};

export const analyticsAPI = {
  getProject: (projectId) => API.get(`/analytics/project/${projectId}`),
  getLeaderboard: () => API.get('/analytics/leaderboard'),
};

export const learningAPI = {
  getModules: () => API.get('/learning/modules'),
  getModule: (id) => API.get(`/learning/modules/${id}`),
  submitQuiz: (id, answers) => API.post(`/learning/modules/${id}/quiz`, { answers }),
  completeModule: (id) => API.post(`/learning/modules/${id}/complete`),
};

export default API;
