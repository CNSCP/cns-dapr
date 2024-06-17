FROM node:18

WORKDIR /app

# Install Dapr Binary
RUN wget -q https://raw.githubusercontent.com/dapr/cli/master/install/install.sh -O - | /bin/bash

COPY package.json package-lock.json /app/
RUN npm install
COPY . /app

CMD ["npm", "run", "start"]
