'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err?.message || 'Something went wrong.' }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          minHeight: '100vh',
          background: '#070D1B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            maxWidth: 480,
            textAlign: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: '48px 32px',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <h2 style={{
              fontFamily: 'Syne, serif',
              fontWeight: 700,
              fontSize: 22,
              color: 'white',
              marginBottom: 12,
            }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 14, color: '#6B7BA0', lineHeight: 1.7, marginBottom: 24 }}>
              {this.state.message.includes('fetch') || this.state.message.includes('network')
                ? 'Cannot reach the backend. Make sure the server is running on port 8000.'
                : this.state.message}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, message: '' })}
              style={{
                background: 'linear-gradient(135deg, #06B6D4, #4F46E5)',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                padding: '12px 28px',
                fontFamily: 'Syne, serif',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                marginRight: 10,
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                background: 'transparent',
                color: '#6B7BA0',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '12px 28px',
                fontFamily: 'Syne, serif',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Go home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
