import * as admin from 'firebase-admin';
import { Client, Product } from '../../../src/types';

// Initialize the app if it hasn't been already
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Normalizes a string for matching: lowercase, trim, remove diacritics
 */
function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove diacritics
}

/**
 * Calculates the Jaro-Winkler similarity between two strings.
 * Returns a value between 0.0 (completely different) and 1.0 (exact match).
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  const str1 = normalizeString(s1);
  const str2 = normalizeString(s2);

  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;

  const mWeight = 0.1;
  const matchWindow = Math.max(0, Math.floor(Math.max(str1.length, str2.length) / 2) - 1);
  
  const matches1 = new Array(str1.length).fill(false);
  const matches2 = new Array(str2.length).fill(false);
  
  let matchCount = 0;

  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, str2.length);
    
    for (let j = start; j < end; j++) {
      if (!matches2[j] && str1[i] === str2[j]) {
        matches1[i] = true;
        matches2[j] = true;
        matchCount++;
        break;
      }
    }
  }

  if (matchCount === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (matches1[i]) {
      while (!matches2[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }
  }
  transpositions /= 2;

  const jaro = (
    matchCount / str1.length +
    matchCount / str2.length +
    (matchCount - transpositions) / matchCount
  ) / 3;

  let prefixLength = 0;
  const maxPrefix = Math.min(4, Math.min(str1.length, str2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (str1[i] === str2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  return jaro + (prefixLength * mWeight * (1 - jaro));
}

export interface MatchResult<T> {
  exact: T | null;
  fuzzy: T[];
  none: boolean;
}

/**
 * Finds a client by name using exact, prefix, and fuzzy matching.
 */
export async function findClientByName(businessId: string, name: string): Promise<MatchResult<Client>> {
  if (!name) return { exact: null, fuzzy: [], none: true };

  const db = admin.firestore();
  const clientsRef = db.collection(`businesses/${businessId}/clients`);
  
  // 1. Try exact match first
  const exactSnapshot = await clientsRef.where('name', '==', name).limit(1).get();
  if (!exactSnapshot.empty) {
    const doc = exactSnapshot.docs[0];
    return { exact: { id: doc.id, ...doc.data() } as Client, fuzzy: [], none: false };
  }

  // 2. Fetch all clients and apply Jaro-Winkler similarity
  // In a massive database we'd use a text search engine like Algolia,
  // but for typical SME client lists (e.g. < 500 clients), reading them all or using prefix bounds is fine.
  // We'll read all active clients and sort by similarity.
  const allClientsSnapshot = await clientsRef.get();
  
  const fuzzyMatches: { client: Client, score: number }[] = [];
  
  allClientsSnapshot.forEach(doc => {
    const clientData = doc.data() as Omit<Client, 'id'>;
    const score = jaroWinklerSimilarity(name, clientData.name);
    
    // Threshold for acceptable similarity
    if (score >= 0.75) {
      fuzzyMatches.push({
        client: { id: doc.id, ...clientData },
        score
      });
    }
  });

  fuzzyMatches.sort((a, b) => b.score - a.score);

  const fuzzy = fuzzyMatches.map(f => f.client);
  
  return {
    exact: null,
    fuzzy,
    none: fuzzy.length === 0
  };
}

/**
 * Finds a product by label using exact, prefix, and fuzzy matching.
 */
export async function findProductByLabel(businessId: string, label: string): Promise<MatchResult<Product>> {
  if (!label) return { exact: null, fuzzy: [], none: true };

  const db = admin.firestore();
  const productsRef = db.collection(`businesses/${businessId}/products`);
  
  // 1. Try exact match first
  const exactSnapshot = await productsRef
    .where('label', '==', label)
    .where('isActive', '==', true)
    .limit(1)
    .get();
    
  if (!exactSnapshot.empty) {
    const doc = exactSnapshot.docs[0];
    return { exact: { id: doc.id, ...doc.data() } as Product, fuzzy: [], none: false };
  }

  // 2. Fetch active products and apply Jaro-Winkler
  const activeProductsSnapshot = await productsRef.where('isActive', '==', true).get();
  
  const fuzzyMatches: { product: Product, score: number }[] = [];
  
  activeProductsSnapshot.forEach(doc => {
    const productData = doc.data() as Omit<Product, 'id'>;
    const score = jaroWinklerSimilarity(label, productData.label);
    
    if (score >= 0.75) {
      fuzzyMatches.push({
        product: { id: doc.id, ...productData },
        score
      });
    }
  });

  fuzzyMatches.sort((a, b) => b.score - a.score);

  const fuzzy = fuzzyMatches.map(f => f.product);
  
  return {
    exact: null,
    fuzzy,
    none: fuzzy.length === 0
  };
}
