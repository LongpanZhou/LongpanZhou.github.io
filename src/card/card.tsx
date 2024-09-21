import '../profile/profile.css';
import resume from '../profile/Longpan_Zhou__Internship_.pdf';

function Card() {
    return (
        <div className='profile-container'>
            <div className='card-container'>
                <div className='bigger-card'>
                    <h1 className="card-title">Let's take a peek at my resume...</h1>
                    <iframe
                        src={resume}
                        width="100%"
                        height="800px" // Set a fixed height here
                        style={{ border: 'none' }}
                    >
                        This browser does not support PDFs. Please download the PDF to view it: 
                        <a href={resume}>Download PDF</a>
                    </iframe>
                </div>
            </div>
        </div>
    );
}

export default Card;
