# Usa l'immagine base ufficiale di Node.js
FROM node:14

# Installa FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Crea e imposta la directory di lavoro
WORKDIR /usr/src/app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa le dipendenze del progetto
RUN npm install

# Copia tutto il resto del codice dell'applicazione
COPY . .

# Esponi la porta su cui il server verrà eseguito
EXPOSE 3090

# Comando per avviare l'applicazione
CMD ["node", "server.js"]
