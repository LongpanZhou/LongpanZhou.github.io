import React from 'react';
import './download.css';
import download_icon from './download.png'

function Download(props: { src: string, alt: string }) {
  return (
    <a
      href={props.src}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className='floating-circle'>
        <div className='icon-div'>
          <img className='download-icon' src={download_icon} />
        </div>
        <div className='floating-text'>{props.alt}</div>
      </div>
    </a>
  );
}

export default Download;