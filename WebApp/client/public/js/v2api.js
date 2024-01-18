export function put(endpoint, body){
  return fetch(`/uapp/v2${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}

export function get(endpoint){
  return fetch(`/uapp/v2${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
}
