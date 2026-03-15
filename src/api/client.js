import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth tokens and logging
api.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      if (config.headers && config.headers['Content-Type']) {
        delete config.headers['Content-Type'];
      }
    }
    
    // Add auth token if available
    const token = localStorage.getItem('securePrintToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and logging
api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('[API Response Error]', error);
    
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          console.error('Bad Request:', data?.error || 'Invalid request data');
          break;
        case 401:
          console.error('Unauthorized: Please log in again');
          // Optionally redirect to login
          break;
        case 403:
          console.error('Forbidden:', data?.error || 'Access denied');
          break;
        case 404:
          console.error('Not Found:', data?.error || 'Resource not found');
          break;
        case 409:
          console.error('Conflict:', data?.error || 'Resource conflict');
          break;
        case 422:
          console.error('Unprocessable Entity:', data?.error || 'Validation failed');
          break;
        case 500:
          console.error('Internal Server Error:', data?.error || 'Server error occurred');
          break;
        case 502:
        case 503:
        case 504:
          console.error('Service Unavailable:', data?.error || 'Server temporarily unavailable');
          break;
        default:
          console.error(`HTTP ${status}:`, data?.error || 'Unknown error');
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network Error: No response received from server');
    } else {
      // Something else happened
      console.error('Request Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Custom error classes for better error handling
class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

class ValidationError extends ApiError {
  constructor(message, errors) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

class AuthenticationError extends ApiError {
  constructor(message) {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends ApiError {
  constructor(message) {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends ApiError {
  constructor(message) {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

// Utility function to handle API errors gracefully
export const handleApiError = (error, defaultMessage = 'An error occurred') => {
  if (error instanceof ApiError) {
    return error.message;
  }
  
  if (error.response) {
    return error.response.data?.error || defaultMessage;
  }
  
  if (error.request) {
    return 'Network error - please check your connection';
  }
  
  return error.message || defaultMessage;
};

// Utility function to validate API responses
export const validateApiResponse = (response, requiredFields = []) => {
  if (!response || typeof response !== 'object') {
    throw new ApiError('Invalid API response format', 500, 'INVALID_RESPONSE');
  }
  
  if (response.error) {
    throw new ApiError(response.error, response.status || 500, response.code || 'API_ERROR');
  }
  
  // Check required fields
  for (const field of requiredFields) {
    if (!(field in response)) {
      throw new ApiError(`Missing required field: ${field}`, 500, 'MISSING_FIELD');
    }
  }
  
  return response;
};

export { 
  ApiError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError 
};

export default api;
