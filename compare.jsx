{users.length > 0 && (
    <div>
        <h4>Users:</h4>
        {users.map((user) => (
            <div key={user._id} className="the-srch-box">
                  <div className="repo-name-link">
                                           <p style={{ color: "#74b9ff", display: "flex", fontWeight: "500"}}>
                                            <div className="the-user">{repo.owner.username.charAt(0).toUpperCase()}</div><div  className='repo-main-info'><div className='repo-name-underline'  onClick={() => navigate(`/${repo.name}`)}>{user.username}</div>
             
                </div>
                </p>
                </div>
                {/* Add any other user info you want to display */}
            </div>
        ))}
    </div>
)}