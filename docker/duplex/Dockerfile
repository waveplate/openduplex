FROM debian:bullseye

RUN apt-get update && apt-get -y install baresip sox curl psmisc procps pulseaudio vlc jq espeak festival ffmpeg nano

RUN curl -fsSL https://deb.nodesource.com/setup_19.x | bash && \
    apt-get install -y nodejs

RUN sed "s/^load-module module-console-kit/#load-module module-console-kit/" -i /etc/pulse/default.pa \
    && mkdir -p /audio \
    && chmod 0777 /audio \
    && useradd -u 1000 -m -d /home/duplex -s /bin/bash duplex \
    && usermod -aG audio duplex

COPY entrypoint.sh /
RUN chmod 777 /tmp

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
