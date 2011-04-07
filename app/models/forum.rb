# == Schema Info
#
# Table name: forums
#
#  id           :integer         not null, primary key
#  category_id  :integer
#  name         :string(255)
#  description  :text
#  topics_count :integer         default(0)
#  posts_count  :integer         default(0)
#  position     :integer         default(0)

class Forum < ActiveRecord::Base
    
  attr_accessible :category_id, :name, :description, :position
  
  belongs_to :category
  
  has_many :topics, :order => 'topics.last_post_at desc', :dependent => :destroy
  has_one :last_topic, :class_name => "Topic", :order => "last_post_at desc"
  
  validates_presence_of :name, :category_id
  validates_uniqueness_of :name, :case_sensitive => false
    
  def to_s
    name
  end
  
  def to_param
    "#{id}-#{to_s.parameterize}"
  end
  
end
