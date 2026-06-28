import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

const CheatingLogContext = createContext();

export const CheatingLogProvider = ({ children }) => {
  const { userInfo } = useSelector((state) => state.auth);
  const [cheatingLog, setCheatingLog] = useState({
    noFaceCount: 0,
    multipleFaceCount: 0,
    cellPhoneCount: 0,
    prohibitedObjectCount: 0,
    tabSwitchCount: 0,
    examId: '',
    username: userInfo?.name || '',
    email: userInfo?.email || '',
    screenshots: [],
  });

  useEffect(() => {
    if (userInfo) {
      setCheatingLog((prev) => ({
        ...prev,
        username: userInfo.name,
        email: userInfo.email,
      }));
    }
  }, [userInfo]);

  const updateCheatingLog = (newLog) => {
    // Support both object merges and functional updaters to avoid stale state issues
    if (typeof newLog === 'function') {
      setCheatingLog((prev) => {
        const delta = newLog(prev) || {};
        const updated = {
          ...prev,
          ...delta,

          noFaceCount: Number(delta.noFaceCount ?? prev.noFaceCount ?? 0),
          multipleFaceCount: Number(delta.multipleFaceCount ?? prev.multipleFaceCount ?? 0),
          cellPhoneCount: Number(delta.cellPhoneCount ?? prev.cellPhoneCount ?? 0),
          prohibitedObjectCount: Number(
            delta.prohibitedObjectCount ?? prev.prohibitedObjectCount ?? 0,
          ),
          tabSwitchCount: Number(delta.tabSwitchCount ?? prev.tabSwitchCount ?? 0),

          screenshots: delta.screenshots ?? prev.screenshots ?? [],
        };

        return updated;
      });
    } else {
      setCheatingLog((prev) => {
        const updated = {
          ...prev,
          ...newLog,

          noFaceCount: Number(newLog.noFaceCount ?? prev.noFaceCount ?? 0),
          multipleFaceCount: Number(newLog.multipleFaceCount ?? prev.multipleFaceCount ?? 0),
          cellPhoneCount: Number(newLog.cellPhoneCount ?? prev.cellPhoneCount ?? 0),
          prohibitedObjectCount: Number(
            newLog.prohibitedObjectCount ?? prev.prohibitedObjectCount ?? 0,
          ),
          tabSwitchCount: Number(newLog.tabSwitchCount ?? prev.tabSwitchCount ?? 0),

          screenshots: newLog.screenshots ?? prev.screenshots ?? [], // ✅ FIX
        };

        return updated;
      });
    }
  };

  const resetCheatingLog = (examId) => {
    setCheatingLog({
      noFaceCount: 0,
      multipleFaceCount: 0,
      cellPhoneCount: 0,
      prohibitedObjectCount: 0,
      tabSwitchCount: 0,
      examId,
      username: userInfo?.name || '',
      email: userInfo?.email || '',
      screenshots: [], // keep explicit
    });
  };

  return (
    <CheatingLogContext.Provider value={{ cheatingLog, updateCheatingLog, resetCheatingLog }}>
      {children}
    </CheatingLogContext.Provider>
  );
};

export const useCheatingLog = () => {
  const context = useContext(CheatingLogContext);
  if (!context) {
    throw new Error('useCheatingLog must be used within a CheatingLogProvider');
  }
  return context;
};
