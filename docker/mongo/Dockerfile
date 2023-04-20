FROM mongo

COPY mongo.script /tmp
COPY setup-db.sh /tmp
RUN chmod +x /tmp/setup-db.sh
RUN chmod +x /tmp/mongo.script

ENTRYPOINT ["bash", "/tmp/setup-db.sh"]