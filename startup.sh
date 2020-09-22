echo  "Run startup script:" `date +%Y-%m-%d:%H:%M:%S`

sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8081

forever stop chat.pairly || true
npm run forever --prefix /home/ubuntu/chat.pairly/server
