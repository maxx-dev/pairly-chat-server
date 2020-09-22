# Updates
sudo apt update

# Install node.js
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs

# Module to run server forever
sudo npm install forever -g

# Unzip required for deployment
sudo apt-get install unzip

# Database setup
sudo apt-get install mysql-server
sudo systemctl start mysql

# Modify DB Settings
sudo mysql -u root -p # pw is root
# Then run:  ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'yourcustomPassword';

# Ip Tables setup (is deleted with every restart of instance)
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8081

# Copy Code to server and run npm install