
import { useState, useEffect, useRef } from 'react';

export const usePullToRefresh = (onRefresh: () => Promise<any>) => {
    const [startPoint, setStartPoint] = useState(0);
    const [pullChange, setPullChange] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    // Only enable if at top of page
    const isAtTop = () => window.scrollY === 0;

    // Disabled to fix scroll issues
    return { refreshing: false, pullChange: 0 };
};
