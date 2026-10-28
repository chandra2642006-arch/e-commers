FROM nginx:alpine

# Copy frontend files into nginx html directory
COPY . /usr/share/nginx/html

# Nginx config to serve static files and proxy /api/ to Flask
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
