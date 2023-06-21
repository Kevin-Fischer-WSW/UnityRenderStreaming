export function unityFetch (endpoint, init) {
  return fetch(`/uapp${endpoint}`, init)
}

export function unityPutJson (endpoint, body) {
  return unityFetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}
