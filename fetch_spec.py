import json, urllib.request
try:
    r = urllib.request.urlopen('http://localhost:8111/openapi.json')
    data = json.loads(r.read())
    data['servers'] = [{'url': 'https://fair-ducks-grow.loca.lt'}]
    
    # Add bypass header to every endpoint so localtunnel doesn't block it
    for path, path_item in data.get('paths', {}).items():
        for method, operation in path_item.items():
            if 'parameters' not in operation:
                operation['parameters'] = []
            operation['parameters'].append({
                "name": "Bypass-Tunnel-Reminder",
                "in": "header",
                "required": True,
                "schema": {"type": "string", "default": "true"}
            })
            
    with open('target_openapi.json', 'w') as f:
        json.dump(data, f)
    print('Saved to target_openapi.json')
except Exception as e:
    print(f'Error: {e}')
