# Base image
FROM node:18-alpine as build

# Create app directory
WORKDIR /usr/src/app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY . .

# Install app dependencies
RUN npm ci




ENV NODE_ENV production

# Creates a "dist" folder with the production build
RUN npm run build

FROM node:18-alpine as production

#WORKDIR /app

COPY --from=build /usr/src/app/dist ./dist 
COPY --from=build /usr/src/app/node_modules ./node_modules 

EXPOSE 5000

# Start the server using the production build
CMD [ "node", "dist/main.js" ]

