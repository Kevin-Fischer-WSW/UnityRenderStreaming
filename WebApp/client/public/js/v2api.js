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

export function del(endpoint){
  return fetch(`/uapp/v2${endpoint}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export function checkErrorCode(respData, code){
  if (respData.ErrorCode === code){
    return true;
  } else if (respData.ErrorCode === 14){
    // Multiple responses returned from the server.
    for (let i = 0; i < respData.Responses.count; i++) {
      if (respData.Responses[i].ErrorCode === code){
        return true;
      }
    }
  }
  return false;
}

export function getErrorMessagesAndResolutions(respData){
  let errorMessages = [];
  let resolutions = [];
  if (respData.ErrorCode === 14){
    // Multiple responses returned from the server.
    for (let i = 0; i < respData.Responses.count; i++) {
      errorMessages.push(respData.Responses[i].ErrorMessage);
      resolutions.push(respData.Responses[i].Resolution);
    }
  } else {
    errorMessages.push(respData.ErrorMessage);
    resolutions.push(respData.Resolution);
  }
  return {errorMessages, resolutions};
}
