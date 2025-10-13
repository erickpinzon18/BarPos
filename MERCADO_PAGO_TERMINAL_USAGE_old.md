1 Obtener lista de terminales
ref: https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/terminals/get-terminals/get
url 
https://api.mercadopago.com/point/integration-api/devices
method
GET
headers
[{"key":"Content-Type","value":"application/json"},{"key":"Authorization","value":"Bearer APP_USR-TOKEN"}]  
return
{"devices":[{"id":"ID","pos_id":ID,"store_id":"ID","external_pos_id":"","operating_mode":"PDV / STANDALONE"}]}

2 Poner primero terminal en PDV
ref: https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/terminals/update-operation-mode/patch
url
https://api.mercadopago.com/point/integration-api/devices/{device_id}
method
PATCH
headers
[{"key":"Content-Type","value":"application/json"},{"key":"Authorization","value":"Bearer APP_USR-TOKEN"}]
body
{"operating_mode":"PDV"}


3 Mandar cobro a terminal
ref: https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/orders/create-order/post
url
https://api.mercadopago.com/v1/orders
method
POST
headers
[{"key":"Content-Type","value":"application/json"},{"key":"Authorization","value":"Bearer APP_USR-TOKENS"},{"key":"X-Idempotency-Key","value":{UUID V4}}]
body
{"type":"point","external_reference":"ext_ref_1234","expiration_time":"PT3M","transactions":{"payments":[{"amount":"10"}]},"config":{"point":{"terminal_id":{terminal_id},"print_on_terminal":"seller_ticket"}},"description":"Description"}
return 
{
    "id": "ID",
    "type": "point",
    "processing_mode": "automatic",
    "external_reference": "ext_ref_1234",
    "description": "Description",
    "expiration_time": "PT3M",
    "country_code": "MEX",
    "user_id": "ID",
    "status": "created",
    "status_detail": "created",
    "currency": "MXN",
    "created_date": "2025-10-13T03:09:47.562Z",
    "last_updated_date": "2025-10-13T03:09:47.562Z",
    "integration_data": {
        "application_id": "ID"
    },
    "transactions": {
        "payments": [
            {
                "id": "ID",
                "amount": "10.00",
                "status": "created"
            }
        ]
    },
    "config": {
        "point": {
            "terminal_id": "ID",
            "print_on_terminal": "seller_ticket"
        }
    }
}

4 Consultar estado de cobro
ref: https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/orders/get-order/get
url
https://api.mercadopago.com/v1/orders/ID
method
GET
headers
[{"key":"Content-Type","value":"application/json"},{"key":"Authorization","value":"Bearer APP_USR-TOKEN"}]
return
{
    "id": "ID",
    "type": "point",
    "processing_mode": "automatic",
    "external_reference": "ext_ref_1234",
    "description": "Description",
    "expiration_time": "PT3M",
    "country_code": "MEX",
    "user_id": "2229414856",
    "status": "at_terminal",
    "status_detail": "at_terminal",
    "currency": "MXN",
    "created_date": "2025-10-13T03:21:49.528Z",
    "last_updated_date": "2025-10-13T03:21:50.681Z",
    "integration_data": {
        "application_id": "ID"
    },
    "transactions": {
        "payments": [
            {
                "id": "ID",
                "amount": "10.00",
                "status": "at_terminal"
            }
        ]
    },
    "config": {
        "point": {
            "terminal_id": "ID",
            "print_on_terminal": "seller_ticket"
        }
    }
}

5 Cancelar cobro (opcional)
ref: https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/orders/cancel-order/post
url
https://api.mercadopago.com/v1/orders/ID/cancel
method
POST
headers
[{"key":"Content-Type","value":"application/json"},{"key":"Authorization","value":"Bearer APP_USR-TOKEN"}, {"key":"X-Idempotency-Key","value":{UUID V4}}]
return
{
    "id": "ID",
    "type": "point",
    "processing_mode": "automatic",
    "external_reference": "ext_ref_1234",
    "description": "Description",
    "expiration_time": "PT3M",
    "country_code": "MEX",
    "user_id": "2229414856",
    "status": "canceled",
    "status_detail": "canceled",
    "currency": "MXN",
    "created_date": "2025-10-13T03:09:47.562Z",
    "last_updated_date": "2025-10-13T03:10:06.128Z",
    "integration_data": {
        "application_id": "ID"
    },
    "transactions": {
        "payments": [
            {
                "id": "ID",
                "amount": "10.00",
                "status": "canceled",
                "status_detail": "canceled_by_api"
            }
        ]
    },
    "config": {
        "point": {
            "terminal_id": "ID",
            "print_on_terminal": "seller_ticket"
        }
    }
}