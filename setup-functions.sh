#!/bin/bash

# 🚀 Script de instalación de Firebase Functions para Mercado Pago Proxy
# Este script configura automáticamente el proxy necesario para producción

set -e  # Detener si hay algún error

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Configuración de Firebase Functions - Mercado Pago Proxy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

echo "✅ Directorio correcto"
echo ""

# 2. Instalar dependencias de Functions
echo "📦 Instalando dependencias de Firebase Functions..."
cd functions
npm install
cd ..
echo "✅ Dependencias instaladas"
echo ""

# 3. Verificar que Firebase CLI esté instalado
if ! command -v firebase &> /dev/null; then
    echo "⚠️  Firebase CLI no está instalado"
    echo "Instalando Firebase CLI..."
    npm install -g firebase-tools
    echo "✅ Firebase CLI instalado"
else
    echo "✅ Firebase CLI ya está instalado"
fi
echo ""

# 4. Login a Firebase (si no está logueado)
echo "🔐 Verificando autenticación en Firebase..."
if ! firebase projects:list &> /dev/null; then
    echo "Necesitas autenticarte en Firebase..."
    firebase login
fi
echo "✅ Autenticado en Firebase"
echo ""

# 5. Verificar que el proyecto esté seleccionado
echo "📋 Proyectos disponibles:"
firebase projects:list
echo ""

# 6. Pedir el Access Token de Mercado Pago
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 Configuración del Access Token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Por favor, ingresa tu VITE_MERCADOPAGO_ACCESS_TOKEN"
echo "(Puedes encontrarlo en tu archivo .env)"
echo ""
read -p "Access Token: " ACCESS_TOKEN
echo ""

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Error: El Access Token no puede estar vacío"
    exit 1
fi

# 7. Configurar el token en Firebase
echo "⚙️  Configurando el token en Firebase Functions..."
firebase functions:config:set mercadopago.access_token="$ACCESS_TOKEN"
echo "✅ Token configurado"
echo ""

# 8. Verificar configuración
echo "📋 Verificando configuración..."
firebase functions:config:get
echo ""

# 9. Preguntar si quiere hacer el deploy ahora
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "¿Quieres desplegar las functions ahora? (y/n): " DEPLOY_NOW
echo ""

if [ "$DEPLOY_NOW" = "y" ] || [ "$DEPLOY_NOW" = "Y" ]; then
    echo "🏗️  Building frontend..."
    npm run build
    echo ""
    
    echo "🚀 Desplegando Firebase Functions..."
    firebase deploy --only functions
    echo ""
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ ¡Deploy completado!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Tu función está disponible en:"
    firebase functions:list
else
    echo "⏭️  Deploy omitido"
    echo ""
    echo "Para desplegar más tarde, ejecuta:"
    echo "  npm run build"
    echo "  firebase deploy --only functions"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Configuración completa"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Lee FIREBASE_FUNCTIONS_SETUP.md para más información"
echo ""
