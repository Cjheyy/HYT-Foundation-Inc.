import React from 'react';
import { Card } from './Card';
import { Icon } from './icons';

/**
 * Error Boundary Component
 * Catches unhandled errors in React component tree to prevent concurrent rendering crashes
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px'
        }}>
          <Card style={{ 
            maxWidth: '600px', 
            padding: '40px',
            textAlign: 'center' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }} aria-hidden="true"><Icon name="alert" size={56} color="#D57156" /></div>
            <h1 style={{ 
              fontSize: '24px', 
              fontWeight: '700',
              color: '#1F2937',
              marginBottom: '16px'
            }}>
              Oops! Something went wrong
            </h1>
            <p style={{ 
              fontSize: '15px',
              color: '#6B7280',
              lineHeight: '1.6',
              marginBottom: '24px'
            }}>
              We encountered an unexpected error. Don't worry, your data is safe.
              Click the button below to return to the home page.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#FEE2E2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                textAlign: 'left',
                fontSize: '13px',
                color: '#991B1B',
                overflowX: 'auto'
              }}>
                <strong>Error Details (Dev Only):</strong>
                <pre style={{ 
                  marginTop: '8px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {this.state.error.toString()}
                </pre>
              </div>
            )}
            
            <button
              onClick={this.handleReset}
              style={{
                marginTop: '24px',
                padding: '12px 32px',
                fontSize: '16px',
                fontWeight: '600',
                color: 'white',
                background: '#667eea',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#764ba2';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#667eea';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Return to Home
            </button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
