import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query } from 'firebase/firestore'
import { db } from './firebase.js'

/** Berlangganan koleksi Firestore. path = array segmen, mis. ['satker', id, 'aset']. */
export function useCollection(path, constraints = [], deps = []) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const key = path ? path.join('/') : null
  useEffect(() => {
    if (!key || path.some((p) => !p)) { setData([]); setLoading(false); return }
    setLoading(true)
    const q = query(collection(db, ...path), ...constraints)
    return onSnapshot(
      q,
      (snap) => { setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false) },
      (e) => { setError(e); setLoading(false) },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps])
  return { data, loading, error }
}

export function useDoc(path) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const key = path ? path.join('/') : null
  useEffect(() => {
    if (!key || path.some((p) => !p)) { setData(null); setLoading(false); return }
    return onSnapshot(doc(db, ...path), (s) => { setData(s.exists() ? { id: s.id, ...s.data() } : null); setLoading(false) }, () => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return { data, loading }
}
