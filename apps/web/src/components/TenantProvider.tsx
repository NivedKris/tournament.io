import React, { createContext, useContext, useEffect, useState } from 'react';

import api, { getTenantSlug } from '../lib/api';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  status: 'active' | 'suspended';
}

interface TenantContextProps {
  tenant: Tenant | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextProps>({ tenant: null, isLoading: true });

export function useTenant() {
  return useContext(TenantContext);
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const slug = getTenantSlug();

  useEffect(() => {
    async function fetchTenant() {
      try {
        const response = await api.get(`/tenant/resolve/${slug}`);
        if (response.data?.success && response.data?.data) {
          const t = response.data.data;
          setTenant(t);
          if (t.primary_color) {
            document.documentElement.style.setProperty('--primary-color', t.primary_color);
            // Dynamic secondary colors/gradients for Apple UI vibe
            document.documentElement.style.setProperty('--primary-glow', `${t.primary_color}33`);
            document.documentElement.style.setProperty('--primary-solid', t.primary_color);
          }
        }
      } catch (err: any) {
        console.error('Failed to resolve tenant:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTenant();
  }, [slug]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#070708',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { to { transform: rotate(360deg); } }
        `}} />
        <p style={{ marginTop: '20px', fontSize: '15px', letterSpacing: '0.05em', color: '#a0a0ab' }}>Loading Arena...</p>
      </div>
    );
  }

  if (tenant?.status === 'suspended') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#070708',
        color: '#fff',
        padding: '24px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          maxWidth: '440px',
          width: '100%',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          padding: '40px',
          textAlign: 'center',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.8)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>⚠️</div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '16px' }}>Portal Suspended</h1>
          <p style={{ fontSize: '15px', color: '#a0a0ab', lineHeight: '1.6', margin: 0 }}>
            The tournament arena for <strong style={{ color: '#fff' }}>{tenant.name}</strong> has been suspended by the administrator. Please reach out to the coordinator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TenantContext.Provider value={{ tenant, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}
