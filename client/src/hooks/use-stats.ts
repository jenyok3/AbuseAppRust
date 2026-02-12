import { useState, useEffect } from 'react';

interface Stats {
  total: number;
  active: number;
  blocked: number;
}

export function useStats() {
  const [data, setData] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // Simulate API call
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setIsError(false);
        
        // Mock data - replace with actual API call
        const mockStats: Stats = {
          total: 20,
          active: 14,
          blocked: 6
        };
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setData(mockStats);
      } catch (error) {
        setIsError(true);
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { data, isLoading, isError };
}
