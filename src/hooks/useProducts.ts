import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Product, CreateDTO, UpdateDTO } from '../types';

export function useProducts() {
  const { business } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!business?.id) {
       setProducts([]);
       setLoading(false);
       return;
    }
    
    // Map structural reactive bounds enforcing native sync
    const q = query(
      collection(db, `businesses/${business.id}/products`),
      orderBy('label', 'asc') // Render alphabetically
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setProducts(items);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Erreur hook synchronisation catalogue:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [business?.id]);

  const addProduct = async (data: CreateDTO<Product>) => {
    if (!business?.id) throw new Error("Aucune entreprise sélectionnée");
    const ref = collection(db, `businesses/${business.id}/products`);
    
    // Inject Firebase structural tracking alongside application logic
    return await addDoc(ref, {
      ...data,
      businessId: business.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  };

  const editProduct = async (id: string, data: UpdateDTO<Product>) => {
    if (!business?.id) throw new Error("Aucune entreprise sélectionnée");
    const ref = doc(db, `businesses/${business.id}/products`, id);
    return await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp()
    });
  };

  const removeProduct = async (id: string) => {
    if (!business?.id) throw new Error("Aucune entreprise sélectionnée");
    return await deleteDoc(doc(db, `businesses/${business.id}/products`, id));
  };

  const toggleActive = async (product: Product) => {
    return await editProduct(product.id, { isActive: !product.isActive });
  };

  // Derive categories structurally avoiding array mutation loops
  const categories = useMemo(() => {
    const raw = products.map(p => p.category).filter(Boolean) as string[];
    return Array.from(new Set(raw)).sort();
  }, [products]);

  return { 
    products, 
    loading, 
    error, 
    categories,
    addProduct, 
    editProduct, 
    removeProduct, 
    toggleActive 
  };
}
