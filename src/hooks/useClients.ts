import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createClient, updateClient, deleteClient } from '../lib/firestore';
import type { Client, CreateDTO, UpdateDTO } from '../types';

export function useClients() {
  const { business } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!business?.id) {
       setClients([]);
       setLoading(false);
       return;
    }
    
    // Establish deep mapping bindings rendering real-time data sync explicitly
    const q = query(
      collection(db, `businesses/${business.id}/clients`),
      orderBy('createdAt', 'desc') // Push newly created ones up natively
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(cls);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Erreur de synchronisation des clients:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [business?.id]);

  const addClient = async (data: CreateDTO<Client>) => {
    if (!business?.id) throw new Error("Aucune entreprise sélectionnée");
    return await createClient(business.id, data);
  };

  const editClient = async (id: string, data: UpdateDTO<Client>) => {
    if (!business?.id) throw new Error("Aucune entreprise sélectionnée");
    return await updateClient(business.id, id, data);
  };

  const removeClient = async (id: string) => {
    if (!business?.id) throw new Error("Aucune entreprise sélectionnée");
    return await deleteClient(business.id, id);
  };

  /**
   * Safe native wrapper pushing O(n) localized filtering mapped for fast interactions.
   */
  const searchClients = (term: string) => {
    if (!term) return clients;
    const lower = term.toLowerCase();
    
    return clients.filter(c => {
       const mappedName = c.name?.toLowerCase() || '';
       const mappedEmail = c.email?.toLowerCase() || '';
       const mappedIce = c.ice || '';
       const mappedPhone = c.phone || '';
       
       return mappedName.includes(lower) 
          || mappedEmail.includes(lower) 
          || mappedIce.includes(lower)
          || mappedPhone.includes(lower);
    });
  };

  return { 
    clients, 
    loading, 
    error, 
    addClient, 
    editClient, 
    removeClient,
    searchClients 
  };
}
