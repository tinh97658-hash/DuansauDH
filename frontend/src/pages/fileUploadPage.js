import React from 'react';
import FileUploader from '../components/fileUploader';
import Footer from '../components/footer';
import ResponsiveAppBar from '../components/navbarNew';


// Function for showing information pages on post graduate programme

function FileUploadPage(){

    return(


        <div>
                <div style={{marginBottom: '100px'}}>
                    <ResponsiveAppBar/>
                </div>

                <div>
                    <FileUploader/>
                </div>

                <div style={{marginTop: '10px'}}>
                    <Footer/>
                </div>
                

            </div>

    )
}

export default FileUploadPage;